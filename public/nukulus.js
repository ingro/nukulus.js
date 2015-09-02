(function (factory) {

    // CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require("underscore"), require("backbone"), require('jquery'));
    }
    // AMD
    else if (typeof define == "function" && define.amd) {
        define(["underscore", "backbone", "jquery"], factory);
    }
    // Browser
    else if (typeof _ !== "undefined" && typeof Backbone !== "undefined") {
        factory(_, Backbone, $);
    }

}(function (_, Backbone, $) {

    "use strict";

    /**
     * Overrides Backbone.sync implementation
     * @param {string} method
     * @param {Backbone.Model} model
     * @param {object} options
     * @return {object} promise
     */
    var NukulusSync = function (method, model, options) {
        options || (options = {});

        var success = options.success || function () {};
        var error = options.error || function () {};

        delete options.success;
        delete options.error;

        var deferred = $.Deferred();

        if (method === 'read' && ! model.id) {
            method = 'list';
        }

        var data = (model.serialize) ? model.serialize() : {};

        this.resource.sync(method, data, options, function (err, res) {
            if (err) {
                console.warn(err);
                error(err);
                deferred.reject(err);
            } else {
                success(res);
                deferred.resolve(res);
            }
        });

        return deferred.promise();
    };

    /**
     * Extended version of Backbone.Model to implement Nukulus's sync
     */
    var NukulusModel = Backbone.Model.extend({

        hideAttr: [],

        sync: function() {
            return NukulusSync.apply(this, arguments);
        },

        constructor: function(models, options) {
            Backbone.Model.prototype.constructor.apply(this, arguments);

            options = options || {};

            this.resource = options.resource || null;
        },

        serialize: function() {
            var obj = this.toJSON();

            return _.omit(obj, this.hideAttr);
        },

        /**
         * Set the resource to which the model is bound
         * @param {Object} resource
         * @return {void}
         */
        setResource: function (resource) {
            this.resource = resource;
        }
    });

    /**
     * Extended version of Backbone.Collection to implement Nukulu's sync
     */
    var NukulusCollection = Backbone.Collection.extend({
        model: NukulusModel,

        sync: function() {
            return NukulusSync.apply(this, arguments);
        },

        /**
         * Overrides Backbone.Collection constructor
         * @param  {array} models
         * @param  {object} options
         * @return {void}
         */
        constructor: function (models, options) {
            Backbone.Collection.prototype.constructor.apply(this, arguments);

            options = options || {};

            if (! this.resource && options.connection) {
                 // this.resource = options.resource || null;
                this.resource = options.connection.resource(options.resourceName);
            }

            var self = this;

            // Aggiungo un riferimento alla risorsa al modello aggiunto
            this.on('add', function (model) {
                model.setResource(self.resource);
            });
        },

        setResource: function (resource) {
            this.resource = resource;
        }
    });

    var Server = function Server(socket, connection) {
        this.socket = socket;
        this.connection = connection;
    };

    var Nukulus = {};

    Nukulus.create = function(socket, connection) {
        return new Server(socket, connection);
    };

    Nukulus.Model = NukulusModel;
    Nukulus.Collection = NukulusCollection;

    /**
     * Basic Nukulus Entities
     */
    // Server.prototype.Entities = {
    //     Collection: NukulusCollection,
    //     Model: NukulusModel
    // };

    /**
     * Get the resource object from a name and a connection
     * @param  {string} name
     * @param  {object} connection
     * @return {object}
     */
    Server.prototype._getResource = function (name, connection) {
        return connection.resource(name);
    };

    /**
     * Bind an existing Backbone.Collection with a given resource
     * @param  {Backbone.Collection} collection
     * @param  {string} resourceName
     * @param  {object} options
     * @return {void}
     */
    Server.prototype.bindCollection = function (collection, resourceName, options) {
        options = options || {};

        var defaults = {
            connection: this.connection,
            autoSync: true
        };

        _.defaults(options, defaults);

        /**
         * Not necessary anymore because it is expected that collections and models involved extends from Nukulus Model and Collection
         */
        // var proto = Object.getPrototypeOf(collection);
        // proto.model = proto.model.extend({ sync: NukulusSync });
        // collection.sync = NukulusSync;

        var resource = this._getResource(resourceName, options.connection);
        collection.setResource(resource);

        this._bindCollectionEvents(resource, collection);

        if (options.autoSync) {
            collection.fetch();
        }
    };

    /**
     * Create a new Nukulus Collection bound to the given resource
     * @param  {string} resourceName
     * @param  {object} options
     * @return {NukulusCollection}
     */
    Server.prototype.createCollection = function (resourceName, options) {
        options = options || {};

        var defaults = {
            connection: this.connection,
            autoSync: true
        };

        options.resourceName = resourceName;

        _.defaults(options, defaults);

        var collection = new NukulusCollection([], options);

        this._bindCollectionEvents(collection.resource, collection);

        if (options.autoSync) {
            collection.fetch();
        }

        return collection;
    };

    /**
     * Bind the synced collection on relevant resource's events
     * @param  {object} resource
     * @param  {NukulusCollection} collection
     * @return {void}
     */
    Server.prototype._bindCollectionEvents = function (resource, collection) {

        this.socket.on('sync_collection', function(resourceName) {
            if (resourceName === resource.name) {
                // console.warn('Server request to sync ' + resourceName);
                collection.fetch();
            }
        });

        resource.subscribe('create', function (data) {
            collection.add(data);
        });

        resource.subscribe('update', function (data) {
            var item = collection.get(data.id);
            if (item) {
                item.set(data);
            }
        });

        resource.subscribe('delete', function (data) {
            collection.remove(data.id);
        });
    };

    /**
     * Bind an existing Backbone.Model with a given resource
     * @param  {Backbone.Model} model
     * @param  {string} resourceName
     * @param  {object} options
     * @return {void}
     */
    Server.prototype.bindModel = function (model, resourceName, options) {
        options = options || {};

        var defaults = {
            connection: this.connection,
            autoSync: true
        };

        options.resourceName = resourceName;

        _.defaults(options, defaults);

        model.sync = NukulusSync;

        var resource = this._getResource(resourceName, options.connection);
        model.setResource(resource);

        this._bindModelEvents(resource, model);

        if (options.autoSync) {
            model.fetch();
        }
    };

    /**
     * Create a new Nukulus model bound to the given resource
     * @param  {string} resourceName
     * @param  {object} options
     * @return {void}
     */
    Server.prototype.createModel = function(resource, options) {
        options = options || {};

        var defaults = {
            connection: this.connection,
            autoSync: true
        };

        options.resourceName = resourceName;

        _.defaults(options, defaults);

        var model = new NukulusModel([], options);

        this._bindModelEvents(model.resource, model);

        if (options.autoSync) {
            model.fetch();
        }

        return model;
    };

    /**
     * Bind the synced model on relevant resource's events
     * @param  {object} resource
     * @param  {NukulusModel} model
     * @return {void}
     */
    Server.prototype._bindModelEvents = function (resource, model) {

        this.socket.on('sync_model', function(resourceName) {
            if (resourceName === resource.name) {
                model.fetch();
            }
        });

        resource.subscribe('update', function (data) {
            model.set(data);
        });

        resource.subscribe('delete', function (data) {
            model.destroy();
        });
    };

    return Nukulus;
}));
