'use strict';

module.exports = function (sender, receiver, layer, content) {
    return new HostMessage(sender, receiver, layer, content);
};

function HostMessage (sender, receiver, layer, content) {
    this.sender = sender;
    this.receiver = receiver;
    this.layer = layer;
    this.content = content;
}

HostMessage.prototype.getAsMultipart = function () {

    var sender = {sender: this.sender};
    var receiver = {receiver: this.receiver};
    var layer = {layer: this.layer};
    var content = {content: this.content};
    return [sender, receiver, layer, content];
};

HostMessage.prototype.stringify = function () {
    return JSON.stringify(this);
};