# nukulus.js
Bidirectional client/server sync with Backbone.js and Data.io

## Getting started

### On the server

```
// Init libraries
var app = express();
var server = require('http').Server(app);

var io = require('socket.io')(server);
var data = require('data.io')(io);

// Create a synced collection
var collection = new Backbone.Collection([{id: 1, name: 'Foo'}]);

var userResource = data.resource('user');

var userStore = Nukulus.Stores.Backbone.Collection({
    collection: collection,
    autoSync: true,
    resourceName: 'user',
    socket: io
});

userResource.use(userStore);
```

### On the client

```
var data = require('data.io');
var Nukulus = require('nukulus');

var socket = io.connect('http://localhost');
var connection = data(socket);
var nukulus = Nukulus.create(socket, connection);

var collection = nukulus.createCollection('user');
```

