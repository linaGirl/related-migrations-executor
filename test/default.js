

var Class = require('ee-class')
        , log = require('ee-log')
        , assert = require('assert')
        , path = require('path')
        , Migration = require('../');

describe('Migration Tools', function () {
    var migrationPath = path.join(__dirname, 'migrations');
    it('Should migrate schema version', function (done) {
        this.timeout(500000);
        setTimeout(function () {
            var tool = new Migration({
                host: 'localhost'
                , user: 'postgres'
                , password: ''
                , database: 'test'
                , schema: 'test'
                , type: 'postgres'
            });
            tool.migrate(migrationPath, function (error, message) {

                if (error instanceof Error)
                    return done(error);
                done();
            });
        }, 20000);
    });
});