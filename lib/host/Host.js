'use strict';

var util = require('util'),
    EventEmitter = require('events'),
    EndpointEventEnum = require('siebogjs-common').enums.EndpointEventEnum;


module.exports = Host;

/**
 * Represents a node in a cluster.
 * One machine can have multiple instances of this object.
 * */
function Host(address, alias, type, connectionManager) {
    EventEmitter.call(this);

    var self = this;

    self.address = address;
    self.alias = alias;
    self.type = type;
    self.endpoints = [];
    self.registeredHosts = [];
    self._connectionManager = connectionManager;

    self._connectionManager.on(EndpointEventEnum.MESSAGE, function () {

        var args = Array.apply(null, arguments);
        self.emit.apply(self, [EndpointEventEnum.MESSAGE].concat(args));
    });
}

util.inherits(Host, EventEmitter);

/**
 *
 * */
Host.prototype.listen = function (port, type) {

    var self = this;

    self._connectionManager.listen(port, type, function (err) {

            if(!err)
                self.endpoints.push({address: self.address, port: port, type: type});
    });
};

/**
 *
 * */
Host.prototype.connect = function (address, port, sender) {

    this._connectionManager.connect(address, port, sender);
};


/**
 *
 * */
Host.prototype.disconnect = function (address, port) {

    this._connectionManager.disconnect(address, port);
};


/**
 *
 * */
Host.prototype.subscribe = function (address, port, topics) {

    this._connectionManager.subscribe(address, port, topics);
};


/**
 *
 * */
Host.prototype.unsubscribe = function (address, port, topics) {

    this._connectionManager.subscribe(address, port, topics);
};


/**
 *
 * */
Host.prototype.send = function (receiver, message) {

    this._connectionManager.send(receiver, message);
};


/**
 *
 * */
Host.prototype.publish = function (message, topic) {

    this._connectionManager.publish(topic, message);
};

Host.prototype.registerHost = function (host) {

    if (this.alias === host.alias || !host.alias)
        return;
   
    for (var i = 0; i < this.registeredHosts.length; i++){
        if(host.alias === this.registeredHosts[i].alias)
            return;
    }

    this.registeredHosts.push(host);
    return true;
};

Host.prototype.unregisterHost = function (host) {

    var endpoint = null;

    for (var i = 0; i < this.registeredHosts.length; i++){

        if(host.alias === this.registeredHosts[i].alias) {

            for(var j = 0; j < this.registeredHosts[i].endpoints.length; j++){

                endpoint = this.registeredHosts[i].endpoints[j].address;
                this._connectionManager.disconnect(endpoint.address, endpoint.port);
            }

            break;
        }
    }
};

Host.prototype.getState = function () {

    return {
        address: this.address,
        alias: this.alias,
        type: this.type,
        endpoints: this.endpoints
    };
};