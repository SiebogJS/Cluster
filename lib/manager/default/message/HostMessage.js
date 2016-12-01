'use strict';

module.exports = function (receiver, layer, content) {
    return new HostMessage(receiver, layer, content);
};

function HostMessage (receiver, layer, content) {
    this.receiver = receiver;
    this.layer = layer;
    this.content = content;
}

HostMessage.prototype.getAsMultipart = function () {

    var receiver = {receiver: this.receiver};
    var layer = {layer: this.layer};
    var content = {content: this.content};
    return [receiver, layer, content];
};

HostMessage.prototype.stringify = function () {
    return JSON.stringify(this);
};