!function () {
    'use strict';
    var Class = require('ee-class')
            , ORM = require('related')
            , EventEmitter = require('ee-event-emitter')
            , fs = require('fs')
            , path = require('path')
            , semver = require('semver')
            , sqlFiles = []
            , schemaDirs = []
            , filesLength
            , sqlStatments
            , error;

    /**
     * Return all schema version directories 
     * @param String migrationPath
     * @param Function callback
     */
    function readSchemaDir(migrationPath, callback) {
        fs.readdir(migrationPath, function (err, files) {
            if (err) {
                callback(err);
            }
            filesLength = files.length;
            if (!filesLength) {
                return callback(null, schemaDirs);
            }
            files.forEach(function (file) {
                file = path.resolve(migrationPath, file);
                fs.stat(file, function (err, stats) {
                    if (err) {
                        callback(err);
                    }
                    if (stats && stats.isDirectory() && path.basename(file)[0] !== '.') {
                        if (semver.valid(file)) {
                            schemaDirs.push(file);
                        }
                    }
                    if (!--filesLength) {
                        callback(null, schemaDirs);
                    }
                });
            });
        });
    }

    /**
     * Return all sql files
     * @param String versionPath
     * @param Function callback
     */
    function  readSqlFiles(versionPath, callback) {
        fs.readdir(versionPath, function (err, files) {
            if (err) {
                callback(err);
            }
            filesLength = files.length;
            if (!filesLength) {
                return callback(null, sqlFiles);
            }
            files.forEach(function (file) {
                file = path.resolve(versionPath, file);
                fs.stat(file, function (err, stats) {
                    if (err) {
                        callback(err);
                    }
                    if (stats && !stats.isDirectory() && path.extname(file) === '.sql') {
                        sqlFiles.push(file);
                    }
                    if (!--filesLength) {
                        callback(null, sqlFiles);
                    }
                });
            });
        });
    }

    module.exports = new Class({
        inherits: EventEmitter
        , init: function (config) {

            this.orm = new ORM(config.user
                    , config.password
                    , config.host
                    , config.schema
                    , config.database
                    , config.type);

            this.orm.load(function (err) {
                if (err) {
                    console.log(err);
                } else {
                    this.db = config.schema;

                }
            }.bind(this));
        }
        /**
         * Migrate all sql files of schema version
         * @param String migrationPath
         * @param Function callback
         */
        , migrate: function (migrationPath, callback) {
            if (fs.existsSync(migrationPath)) {
                readSchemaDir(migrationPath, function (err, dirs) {
                    if (err) {
                        callback(err);
                    }
                    dirs.forEach(function (dir) {
                        readSqlFiles(dir, function (err, files) {
                            if (err) {
                                callback(err);
                            }
                            files.forEach(function (file) {
                                sqlStatments = fs.readFileSync(file).toString().split(';').map(function (input) {
                                    return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ');
                                }).filter(function (item) {
                                    return item.length;
                                });
                                console.log(sqlStatments);
                            });

                        });
                    });
                });

            } else {
                error = new Error('Migration path doesn\'t exists');
                error.name = 'InvalidPath';
                callback(error);
            }

        }});
}();