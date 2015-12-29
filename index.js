var ID3 = require('id3-parser');
var fs = require('fs');
var rimraf = require('rimraf');
var artists = {};

var filesDir = process.argv[2];
if (!filesDir) {
    console.log('Usage: id3-parser <filesDir>');
    process.exit();
}

if (!fs.statSync(filesDir)) {
    console.log('Directory ' + filesDir + 'does not exist, or you do not have access to it');
    process.exit();
}

var mp3s = [];

function processFile(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, function (err, file) {
            ID3.parse(file)
                .then(function (tag) {
                    mp3s.push(new MP3(tag, path));
                    resolve();
                });
        });
    });
}

function walkDir(dir) {
    return new Promise(function (resolve, reject) {
        fs.readdir(dir, function (err, files) {
            var promises = [];
            files.forEach(function (file) {
                var stat = fs.statSync(dir + '/' + file);
                promises.push(function () {
                    return Promise.resolve(dir + '/' + file);
                });
                if (stat.isDirectory()) {
                    promises.push(walkDir);
                } else {
                    promises.push(processFile);
                }
            });
            var p = Promise.resolve();
            promises.forEach(function (promise) {
                p = p.then(promise);
            });
            p.then(resolve);
        })
    });
}

rimraf.sync('All Songs.m3u');

rimraf.sync('Artists');

fs.mkdirSync('Artists');

walkDir(filesDir)
    .then(function () {
        var artistMP3s = {};
        mp3s.forEach(function (mp3) {
            if (!artistMP3s[mp3.tags.artist]) {
                artistMP3s[mp3.tags.artist] = {};
            }
            if (!artistMP3s[mp3.tags.artist][mp3.tags.album]) {
                artistMP3s[mp3.tags.artist][mp3.tags.album] = [];
            }
            artistMP3s[mp3.tags.artist][mp3.tags.album].push(mp3);
        });
        var allSongsMP3s = [];
        for (var artist in artistMP3s) {
            fs.mkdirSync('Artists/' + artist);
            var allArtistMP3s = [];
            for (var album in artistMP3s[artist]) {
                artistMP3s[artist][album].sort(function (a, b) {
                    return a.track - b.track;
                });
                var albumM3U = '';
                artistMP3s[artist][album].forEach(function (mp3) {
                    allSongsMP3s.push(mp3);
                    allArtistMP3s.push(mp3);
                    albumM3U += mp3.getM3UEntry(2) + '\n';
                });
                fs.writeFileSync('Artists/' + artist + '/' + album.replace('/', '') + '.m3u', albumM3U);
            }
            allArtistMP3s.sort(function (a, b) {
                var aTitle = a.tags.title.toLowerCase();
                var bTitle = b.tags.title.toLowerCase();
                if (aTitle < bTitle) {
                    return -1;
                } else if (aTitle > bTitle) {
                    return 1
                } else {
                    return 0;
                }
            });
            var allSongsM3U = '';
            allArtistMP3s.forEach(function (mp3) {
                allSongsM3U += mp3.getM3UEntry(2) + '\n';
            });
            fs.writeFileSync('Artists/' + artist + '/All Songs.m3u', allSongsM3U);
        }
        allSongsMP3s.sort(function (a, b) {
            var aTitle = a.tags.title.toLowerCase();
            var bTitle = b.tags.title.toLowerCase();
            if (aTitle < bTitle) {
                return -1;
            } else if (aTitle > bTitle) {
                return 1
            } else {
                return 0;
            }
        });
        var allSongsM3U = '';
        allSongsMP3s.forEach(function (mp3) {
            allSongsM3U += mp3.getM3UEntry(0) + '\n';
        });
        fs.writeFileSync('All Songs.m3u', allSongsM3U);
    });

function MP3(tags, filePath) {
    this.tags = tags;
    this.filePath = filePath;
}

MP3.prototype = {
    getM3UEntry: function (currentPathDepth) {
        var m3uEntry = '#EXTINF,' + this.tags.artist + ' - ' + this.tags.title + '\n';
        for (var i = 0; i < currentPathDepth; i++) {
            m3uEntry += '../';
        }
        m3uEntry += this.filePath;
        return m3uEntry;
    }
}