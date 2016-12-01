'use strict';

var util = require('util'),
    ClusterManager = require('../ClusterManager'),
    ip = require('ip'),
    fs = require('fs'),
    Host = require('../../host/Host'),
    EndpointTypeEnum = require('siebogjs-common').enums.EndpointTypeEnum,
    EndpointEventEnum = require('siebogjs-common').enums.EndpointEventEnum,
    NetworkUtil = require('siebogjs-common').util.network,
    DefaultConnectionManager = require('siebogjs-connection').DefaultConnectionManager,
    HostMessage = require('./message/HostMessage'),
    HostMessageTypeEnum = require('./message/enum/HostMessageTypeEnum'),
    MessageTypeEnum = require('siebogjs-common').enums.MessageTypeEnum,
    Message = require('siebogjs-common').strucs.Message,
    LayerEnum = require('siebogjs-common').enums.LayerEnum;


module.exports = function () {
    return new DefaultClusterManager();
};

const CONFIG_FILE_PATH = __dirname + "/config/config.json";

/**
 * @constructor
 * @extends {ClusterManager}
 * */
function DefaultClusterManager() {
    ClusterManager.call(this);

    this.master = '';
    this.pendingHosts = [];
    this.config = readFromFileSync(CONFIG_FILE_PATH);
}

/**
 * Inheritance
 * */
util.inherits(DefaultClusterManager, ClusterManager);


DefaultClusterManager.prototype.initHost = function () {

    var self = this;

    self.host = new Host(ip.address(), this.config.alias, "", DefaultConnectionManager());

    self.host.on(EndpointEventEnum.MESSAGE, function () {
        var args = Array.apply(null, arguments);
        self.handleMessage.apply(self, args);
    });

    self.master = this.config.master;
    self.initHandlers();
    self.initEndpoints();
};

DefaultClusterManager.prototype.register = function () {

    if (!this.master)
        return;

    var address = this.master.split(':');
    this.host.connect(address[0], address[1], this.getSender());

    var msg = Message(HostMessageTypeEnum.REGISTER_HOST_REQUEST, this.host.getState());
    var message = HostMessage({address: address[0], port: address[1]}, LayerEnum.HOST, msg);
    
    this.host.send({address: address[0], port: address[1]}, message.stringify());
};

DefaultClusterManager.prototype.initEndpoints = function() {

    var self = this;

    NetworkUtil.getRandPort(function (error, port) {

        if(!error) {
            self.host.listen(port, EndpointTypeEnum.PUBLISH);
        }else {
            console.log("Error occurred while binding to port, type: PUBLISH");
        }
    });

    NetworkUtil.getRandPort(function (error, port) {

        if(!error) {
            self.host.listen(port, EndpointTypeEnum.ROUTER);
        }else {
            console.log("Error occurred while binding to port, type: ROUTER");
        }
    });
};

DefaultClusterManager.prototype.handleMessage = function () {

    var args = Array.apply(null, arguments);
    console.log("Message arrived");
    console.log(args.length);
    console.log(args[0].toString());

    try{

        if (args.length == 2){

            var msg = JSON.parse(args[1].toString());
            console.log("Message type", msg.content.type);

            if(msg.layer === LayerEnum.HOST) {
                //console.log(msg);
                this.getHandler(msg.content.type) && this.getHandler(msg.content.type)(args[0].toString(), msg.content.content);
            }else {
                msg.content.sender = args[0];
                this.emit(msg.layer, msg.content);
            }
        }

    }catch (ex) {
        console.log("ERROR : " + ex);
    }
};

DefaultClusterManager.prototype.publish = function (msg, topic) {
    this.host.publish(msg, topic);
};

DefaultClusterManager.prototype.send = function (receiver, msg) {
    this.host.send(receiver, msg);
};

DefaultClusterManager.prototype.initHandlers = function () {

    var self = this;

    self.addHandler(HostMessageTypeEnum.REGISTER_HOST_REQUEST, function (sender, newHost) {
/*
        if(!self.isMaster())
            return;*/

        if (self.host.registerHost(newHost)) {

            var pubmsg = Message(HostMessageTypeEnum.PENDING_HOST, newHost);

            self.host.publish(HostMessage({}, LayerEnum.HOST, pubmsg).stringify(), 'PENDING');

            for(var i = 0; i < newHost.endpoints.length; i++) {

                var endpoint = newHost.endpoints[i];

                if(endpoint.type === EndpointTypeEnum.ROUTER){

                    self.host.connect(endpoint.address, endpoint.port, self.getSender());

                    var receiver = {address: endpoint.address, port: endpoint.port};

                    var msg = Message(HostMessageTypeEnum.REGISTER_HOST_RESPONSE,
                                    [self.host.getState()].concat(self.host.registeredHosts));

                    var message = HostMessage(receiver, LayerEnum.HOST, msg);

                    self.host.send(receiver, message.stringify());

                }else if (endpoint.type === EndpointTypeEnum.PUBLISH) {
                    self.host.subscribe(endpoint.address, endpoint.port, '');
                }
            }
        }

        console.log("Hosts", self.host.registeredHosts.length);
    });

    self.addHandler(HostMessageTypeEnum.REGISTER_HOST_RESPONSE, function (sender, hosts) {

        sender = JSON.parse(sender);

        for(var i = 0; i < hosts.length; i++) {

            if(hosts[i].alias === self.host.alias)
                continue;

            for(var j = 0; j < hosts[i].endpoints.length; j++) {

                var endpoint = hosts[i].endpoints[j];

                if(endpoint.type === EndpointTypeEnum.ROUTER){

                    if(endpoint.address === sender.address && endpoint.port === sender.port) {
                        self.host.registerHost(hosts[i]);
                        continue;
                    }

                    self.host.connect(endpoint.address, endpoint.port, self.getSender());

                    var receiver = {address: endpoint.address, port: endpoint.port};

                    var msg = Message(HostMessageTypeEnum.REGISTER_PENDING_HOST_REQUEST, self.host.getState());

                    var message = HostMessage(receiver, LayerEnum.HOST, msg);

                    self.host.send(receiver, message.stringify());

                }else if (endpoint.type === EndpointTypeEnum.PUBLISH) {
                    self.host.subscribe(endpoint.address, endpoint.port, '');
                }
            }
        }
        console.log("Hosts", self.host.registeredHosts.length);
    });

    self.addHandler(HostMessageTypeEnum.PENDING_HOST, function (sender, host) {
        self.addPendingHost(host);
        console.log("PENDING HOST");
    });

    self.addHandler(HostMessageTypeEnum.REGISTER_PENDING_HOST_REQUEST, function (sender, host) {

        for(var i = 0; i < self.pendingHosts.length; i++) {

            if(self.pendingHosts[i].alias === host.alias) {

                if(self.host.registerHost(host)) {

                    for(var j = 0; j < host.endpoints.length; j++) {

                        var endpoint = host.endpoints[j];

                        if(endpoint.type === EndpointTypeEnum.ROUTER){

                            self.host.connect(endpoint.address, endpoint.port, self.getSender());

                            var receiver = {address: endpoint.address, port: endpoint.port};

                            var msg = Message(HostMessageTypeEnum.REGISTER_PENDING_HOST_RESPONSE, self.host.getState());

                            var message = HostMessage(receiver, LayerEnum.HOST, msg);

                            self.host.send(receiver, message.stringify());

                        }else if (endpoint.type === EndpointTypeEnum.PUBLISH) {
                            self.host.subscribe(endpoint.address, endpoint.port, '');
                        }
                    }

                    self.pendingHosts.splice(i, 1);
                }

                break;
            }
        }

        console.log("Hosts", self.host.registeredHosts.length);
    });

    self.addHandler(HostMessageTypeEnum.REGISTER_PENDING_HOST_RESPONSE, function (sender, host) {

        if (!self.host.registerHost(host)) {

            for (var i = 0; i < host.endpoints.length; i++) {

                var endpoint = host.endpoints[i];

                if (endpoint.type === EndpointTypeEnum.ROUTER) {
                    self.host.disconnect(endpoint.address, endpoint.port);

                }else if (endpoint.type === EndpointTypeEnum.PUBLISH) {
                    self.host.unsubscribe(endpoint.address, endpoint.port, '');
                }
            }
        }

        console.log("Hosts", self.host.registeredHosts.length);
    });


    self.addHandler(HostMessageTypeEnum.PING, function (endpoint, msg) {

    });


    self.addHandler(HostMessageTypeEnum.PONG, function (endpoint, msg) {

    });
};

DefaultClusterManager.prototype.isMaster = function () {
    return !!this.master;
};

DefaultClusterManager.prototype.addPendingHost = function (host) {

    for (var i = 0; i < this.pendingHosts.length; i++){

        if(host.alias === this.pendingHosts[i].alias)
            return;
    }

    this.pendingHosts.push(host);
};

DefaultClusterManager.prototype.getSender = function () {

    for (var i = 0; i < this.host.endpoints.length; i++) {

        if (this.host.endpoints[i].type === EndpointTypeEnum.ROUTER){

            var endpoint = this.host.endpoints[i];
            return {address: endpoint.address, port: endpoint.port};
        }
    }
};

function readFromFileSync (filePath) {

    var data = fs.readFileSync(filePath);
    var config = JSON.parse(data.toString());
    config.alias = config.alias || process.env.LOGNAME;

    return config;
}

