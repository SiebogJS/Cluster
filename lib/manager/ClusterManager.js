'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Host = require('../host/Host');


/**
 * Exports
 * */
module.exports = ClusterManager;

/**
 * @constructor
 * @extends {EventEmitter}
 * */
function ClusterManager() {
    EventEmitter.call(this);

    this.host;
    this._handlers = [];
}

/**
 * Inheritance
 * */
util.inherits(ClusterManager, EventEmitter);


ClusterManager.prototype.addHandler = function (messageType, handler) {

    this._handlers[messageType] = handler;
};

ClusterManager.prototype.getHandler = function (messageType) {

    return this._handlers[messageType];
};

ClusterManager.prototype.handleMessage = function () {

};

ClusterManager.prototype.publish = function (msg, topic) {

};

ClusterManager.prototype.send = function (receiver, msg) {

};

