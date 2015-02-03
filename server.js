var express = require('express');
var path = require('path');
var morgan = require('morgan');
var server = express();

server.use(express.static(path.join(__dirname)));
server.use(morgan('combined'));

server.listen(3000);
console.log('Webserver listening on: http://localhost:3000');
console.log('Webserver local on: ' + path.join(__dirname, 'examples'));
