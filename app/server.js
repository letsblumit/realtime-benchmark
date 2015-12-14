'use strict';

process.env.NODE_ENV = 'production';

var fs = require('fs')
  , http = require('http')
  , sockjs = require('sockjs')
  , express = require('express')
  , config = JSON.parse(fs.readFileSync('config.json'))
  , sockserver = sockjs.createServer(config.sockjs)
  , webserver = http.createServer()
  , pageserver = express()
  , connections = {}

// LIBRARIES -------------------------------------------------------------------

// PubNub
  , pubnub = require('pubnub')(config.accounts.pubnub)

// Pusher
  , Pusher = require('pusher')
  , pusher = new Pusher(config.accounts.pusher)
  , PusherClient = require('pusher-client')
  , pusherClient = new PusherClient(config.accounts.pusher.key)
  , pusherChannel = pusherClient.subscribe(config.channel)

// Firebase
  , Firebase = require('firebase')
  , firebasePub = new Firebase(config.accounts.firebase.domain)
  , firebaseSub = new Firebase(config.accounts.firebase.domain)

// Fanout
  , Fanout = require('fanoutpub')
  , fanout = new Fanout.Fanout(config.accounts.fanout.realmId, config.accounts.fanout.realmKey)
  , Faye = require('faye')
  , faye = new Faye.Client(config.accounts.fanout.domain)

// Hydna
  , hydna = require('hydna')
  , hydnaChannel = hydna.createChannel(config.accounts.hydna.domain, 'readwrite')

// Realtime
  , OrtcNodeclient = require('ibtrealtimesjnode').IbtRealTimeSJNode
  , ortcClient = new OrtcNodeclient()

// Syncano
  , Syncano = require('syncano')
  , syncano = new Syncano({accountKey: config.accounts.syncano.accountKey})

// Ably TODO

// Envoy
  , WebSocket = require('ws')
  , envoy = new WebSocket(config.accounts.envoy.url);

pusher.port = 80;
ortcClient.setConnectionMetadata('UserConnectionMetadata');
ortcClient.setClusterUrl(config.accounts.realtime.clusterUrl);
ortcClient.connect(config.accounts.realtime.appKey, config.accounts.realtime.privateKey);

// SUBSCRIBERS -----------------------------------------------------------------

// PubNub
pubnub.subscribe({
  channel: config.channel,
  callback: function (message) {
    var service = 'PubNub';
    if (message.ping) {
      if (!message.pong && message.ping.id !== config.id) {
        message.pong = {id: config.id, timestamp: Date.now()};
        pubnub.publish({channel: config.channel, message: message});
      } else if (!message.pong && message.ping.id === config.id) {
        message.pong = {id: config.id, timestamp: Date.now()};
        if (connections[message.connId]) {
          connections[message.connId].write(JSON.stringify({
            service: service,
            from: message.ping.id,
            to: message.pong.id,
            time: (Date.now() - message.ping.timestamp) / 1000
          }));
        }
      } else if (message.pong && message.ping.id === config.id) {
        if (connections[message.connId]) {
          connections[message.connId].write(JSON.stringify({
            service: service,
            from: message.ping.id,
            to: message.pong.id,
            time: (Date.now() - message.ping.timestamp) / 1000
          }));
        }
      }
    }
  }
});

// Pusher
pusherChannel.bind(config.channel, function (message) {
  var service = 'Pusher';
  if (message.ping) {
    if (!message.pong && message.ping.id !== config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      pusher.trigger(config.channel, config.channel, message);
    } else if (!message.pong && message.ping.id === config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    } else if (message.pong && message.ping.id === config.id) {
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    }
  }
});

// Firebase
firebaseSub.child('message').on('value', function (data) {
  var message = data.val()
    , service = 'Firebase';
  if (message.ping) {
    if (!message.pong && message.ping.id !== config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      firebasePub.set({message: message});
    } else if (!message.pong && message.ping.id === config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    } else if (message.pong && message.ping.id === config.id) {
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    }
  }
});

// Fanout
faye.subscribe('/' + config.channel, function (message) {
  var service = 'Fanout';
  if (message.ping) {
    if (!message.pong && message.ping.id !== config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      fanout.publish(config.channel, message);
    } else if (!message.pong && message.ping.id === config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    } else if (message.pong && message.ping.id === config.id) {
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    }
  }
});

// Hydna
hydnaChannel.on('data', function (data) {
  var message = JSON.parse(data)
    , service = 'Hydna';
  if (message.ping) {
    if (!message.pong && message.ping.id !== config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      hydnaChannel.write(JSON.stringify(message));
    } else if (!message.pong && message.ping.id === config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    } else if (message.pong && message.ping.id === config.id) {
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    }
  }
});

// Realtime
ortcClient.onConnected = function (ortc) {
  ortc.subscribe(config.channel, true, function (ortc, channel, data) {
    var message = JSON.parse(data)
      , service = 'Realtime';
    if (message.ping) {
      if (!message.pong && message.ping.id !== config.id) {
        message.pong = {id: config.id, timestamp: Date.now()};
        ortcClient.send(config.channel, JSON.stringify(message));
      } else if (!message.pong && message.ping.id === config.id) {
        message.pong = {id: config.id, timestamp: Date.now()};
        if (connections[message.connId]) {
          connections[message.connId].write(JSON.stringify({
            service: service,
            from: message.ping.id,
            to: message.pong.id,
            time: (Date.now() - message.ping.timestamp) / 1000
          }));
        }
      } else if (message.pong && message.ping.id === config.id) {
        if (connections[message.connId]) {
          connections[message.connId].write(JSON.stringify({
            service: service,
            from: message.ping.id,
            to: message.pong.id,
            time: (Date.now() - message.ping.timestamp) / 1000
          }));
        }
      }
    }
  });
};

// Syncano TODO

// Ably TODO

// Envoy
// TODO reconnection
envoy.on('message', function (data) {
  var message = JSON.parse(data)
    , service = 'Envoy';

  if (message.payload &&
    message.action === 'validation') {
    envoy.send(JSON.stringify([{action: 'subscribe', payload: [config.channel]}]));
  }

  if (message.ping) {
    if (!message.pong && message.ping.id !== config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      envoy.send(JSON.stringify([{action: 'publish', payload: {channels: [config.channel], message: message}}]));
    } else if (!message.pong && message.ping.id === config.id) {
      message.pong = {id: config.id, timestamp: Date.now()};
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    } else if (message.pong && message.ping.id === config.id) {
      if (connections[message.connId]) {
        connections[message.connId].write(JSON.stringify({
          service: service,
          from: message.ping.id,
          to: message.pong.id,
          time: (Date.now() - message.ping.timestamp) / 1000
        }));
      }
    }
  }
});

sockserver.on('connection', function (conn) {
  connections[conn.id] = conn;

  conn.on('close', function () {
    delete connections[conn.id];
  });

  conn.on('data', function (data) {
    var message = {ping: {id: config.id, timestamp: Date.now()}, connId: conn.id, size: data};

    // PUBLISHERS ----------------------------------------------------------------

    // PubNub
    pubnub.publish({channel: config.channel, message: message});

    // Pusher
    pusher.trigger(config.channel, config.channel, message);

    // Firebase
    firebasePub.set({message: message});

    // Fanout
    fanout.publish(config.channel, message);

    // Hydna
    hydnaChannel.write(JSON.stringify(message));

    // Realtime
    ortcClient.send(config.channel, JSON.stringify(message));

    // Syncano TODO

    // Ably TODO

    // Envoy
    envoy.send(JSON.stringify([{action: 'publish', payload: {channels: [config.channel], message: message}}]));
  });
});

sockserver.installHandlers(webserver);
webserver.listen(config.port);

pageserver.use(express.static(__dirname));
pageserver.listen(80);
