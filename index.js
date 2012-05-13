var fs = require('fs-ext');

var openFds = [];


exports.closeSync = function(fds) {
  if (!fds) fds = openFds;
  else if (!Array.isArray(fds)) fds = [fds];

  fds.forEach(function(fd) {
    fs.closeSync(fd);
    var index = openFds.indexOf(fd);
    if (~index) {
      openFds.splice(index, 1);
    }
  });
};
exports.close = function(fds, cb) {
  if (arguments.length === 1) {
    cb = fds;
    fds = openFds;
  } else if (!Array.isArray(fds)) {
    fds = [fds];
  }

  var progress = progressTracker(fds.length, cb);

  fds.forEach(function(fd) {
    var index = openFds.indexOf(fd);
    if (~index) {
      openFds.splice(index, 1);
    }
    fs.close(fd, progress);
  });
};

exports.createSync = function(filename, pid) {
  var fd = fs.openSync(filename, 'w');
  fs.flockSync(fd, 'exnb');
  fs.writeSync(fd, pid || process.pid);
  openFds.push(fd);
  return fd;
};

exports.create = function(filename, pid, cb) {
  if (arguments.length === 2) {
    cb = pid;
    pid = process.pid;
  }

  fs.open(filename, 'w', function(err, fd) {
    if (err) return cb(err);

    fs.flock(fd, 'exnb', function(err) {
      if (err) return cb(err);

      fs.write(fd, pid, function(err) {
        if (err) return cb(err);

        openFds.push(fd);
        cb(null, fd);
      });
    });
  });

};

exports.checkSync = function(filename) {
  var fd, pid;

  try {
    fd = fs.openSync(filename, 'r');
  } catch(e) {
    return null;
  }

  try {
    fs.flockSync(fd, 'exnb');
    pid = null;
  } catch(e) {
    pid = new Buffer(20);
    var read = fs.readSync(fd, pid, 0, pid.length, 0);
    pid = pid.slice(0, read).toString('utf8');
    pid = Number(pid);
  }
  fs.closeSync(fd);

  return pid;
};

exports.check = function(filename, cb) {
  fs.open(filename, 'r', function(err, fd) {
    if (err) return cb(null, null);

    fs.flock(fd, 'exnb', function(err) {
      if (!err) return cb(null, null);

      var pid = new Buffer(20);
      fs.readSync(fd, pid, 0, pid.length, 0, function(err, read) {
        if (err) return cb(err);

        pid = pid.slice(0, read).toString('utf8');
        pid = Number(pid);

        fs.close(fd, function(err) {
          if (err) return cb(err);

          cb(null, pid);
        });
      });
    });
  });
};


exports.waitSync = function(filename) {
  var fd = fs.openSync(filename, 'r');
  fs.flockSync(fd, 'ex');
  fs.closeSync(fd);
};

exports.wait = function(filename, cb) {
  var fd = fs.open(filename, 'r', function(err, fd) {
    if (err) return cb(err);

    fs.flock(fd, 'ex', function(err) {
      if (err) return cb(err);

      fs.close(fd, cb);
    });
  });
};


function progressTracker(missing, callback) {
  return function(err) {
    if (err) return callback(err);
    missing -= 1;
    if (this.missing === 0) callback();
  };
}
