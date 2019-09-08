const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));

app.get('/', (req, res) => {
  fs.readFile('./index.html', (err, body) => {
    res.send(err || (body + ''));
  });
});

app.get('/map', (req, res) => {
  fs.readFile('./map.html', (err, body) => {
    res.send(err || (body + ''));
  });
});

app.post('/login', (req, res) => {
  res.redirect('/map');
});

app.listen(process.env.PORT || 8080, (err) => {
  console.log(err || 'Running');
});
