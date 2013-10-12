var util = require('lib/util');
var Observer = require('lib/observer');

module.exports = {
    defaultParams: {
        id: null,
        position: 0,
        percentage: 0,
        width: 1,
        color: '#333'
    },

    getTitle: function () {
        var d = new Date(this.position * 1000);
        return d.getMinutes() + ':' + d.getSeconds();
    },

    update: function (options) {
        Object.keys(options).forEach(function (key) {
            if (key in this.defaultParams) {
                this[key] = options[key];
            }
        }, this);
        if (null == options.position && null != options.percentage) {
            this.position = null;
        }
        this.emit('update');
        return this;
    },

    remove: function () {
        this.emit('remove');
    }
};

util.extend(module.exports, Observer);
