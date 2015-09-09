var Backbone = require('backbone');
var _        = require('lodash');
var uuid     = require('node-uuid');

var Nukulus = {};

var BackboneCollectionStore = function(options) {

    var collection,
    opts,
    defaultOptions = {
        data : [],
        collection: false,
        autoSync: false,
        resourceName: '',
        socket: null
    };

    opts = _.defaults(options, defaultOptions);

    // if (opts.collection instanceof Backbone.Collection) {
    if (opts.collection) {
        collection = opts.collection;
    } else {
        collection = new Backbone.Collection(opts.data);
    }

    if (opts.autoSync) {
        collection.on('change reset update', function() {
            opts.socket.sockets.emit('sync_collection', opts.resourceName);
        });
    }

    return function(req, res, next) {

        var actions = {
            create: function() {
                var model = new Backbone.Model(req.data);
                model.set('id', uuid.v4());
                collection.add(model);
                res.send(model.toJSON());
            },

            read: function() {
                var model = collection.get(req.data.id);
                res.send(model.toJSON());
            },

            list: function() {
                res.send(collection.toJSON());
            },

            update: function() {
                var model = collection.get(req.data.id);
                model.set(req.data);
                res.send(model.toJSON());
            },

            delete: function() {
                var model = collection.get(req.data.id);
                collection.remove(model);
                res.send(req.data);
            }
        };

        if (!actions[req.action]) return next(new Error('Unsuppored action: ' + req.action));
        actions[req.action]();
    };
};

var BackboneModelStore = function(options) {

    var model,
    opts,
    defaultOptions = {
        data : [],
        model: false,
        autoSync: false,
        resourceName: '',
        socket: null
    };

    opts = _.defaults(options, defaultOptions);

    if (opts.model) {
        model = opts.model;
    } else {
        model = new Backbone.Model(opts.data);
    }

    if (opts.autoSync) {
        model.on('change', function() {
            opts.socket.sockets.emit('sync_model', opts.resourceName);
        });
    }

    return function(req, res, next) {

        var actions = {
            read: function() {
                res.send(model.toJSON());
            },

            list: function() {
                res.send(model.toJSON());
            },

            update: function() {
                model.set(req.data);
                res.send(model.toJSON());
            },

            delete: function() {
                // I'm not sure that you destroy a model on the server
                model.destroy();
                res.send(req.data);
            }
        };

        if (!actions[req.action]) return next(new Error('Unsuppored action: ' + req.action));
        actions[req.action]();
    };
};

BackboneStore = {
    Collection: BackboneCollectionStore,
    Model: BackboneModelStore
};

Nukulus.Stores = {
    Backbone: BackboneStore
};

module.exports = Nukulus;
