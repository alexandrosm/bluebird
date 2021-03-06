
var args = require('optimist').argv;

var util = require('util');

var path = require('path');

function printPlatform() {
    console.log("\nPlatform info:");
    var os = require("os");
    var v8 = process.versions.v8;
    var node = process.versions.node;
    var plat = os.type() + " " + os.release() + " " + os.arch() + "\nNode.JS " + node + "\nV8 " + v8;
    var cpus = os.cpus().map(function(cpu){
        return cpu.model;
    }).reduce(function(o, model){
        if( !o[model] ) o[model] = 0;
        o[model]++;
        return o;
    }, {});
    cpus = Object.keys(cpus).map(function( key ){
        return key + " \u00d7 " + cpus[key];
    }).join("\n");
    console.log(plat + "\n" + cpus + "\n");
}

var perf = module.exports = function(args, done) {

    var errs = 0;
    var lastErr;
    var times = args.n;

    global.asyncTime = args.t;

    if (args.longStackSupport) {
        global.longStackSupport = require('q').longStackSupport
            = args.longStackSupport;
        require('bluebird').longStackTraces();
    }

    var fn = require(args.file);

    var start = Date.now();


    var warmedUp = 0;
    var tot =  Math.min( 350, times );
    for (var k = 0, kn = tot; k < kn; ++k)
        fn('a','b','c', warmup);

    var memMax; var memStart; var start;
    function warmup() {
        warmedUp++
        if( warmedUp === tot ) {
            start = Date.now();

            memStart = process.memoryUsage().rss;
            for (var k = 0, kn = args.n; k < kn; ++k)
                fn('a','b','c', cb);
            memMax = process.memoryUsage().rss;
        }
    }

    function cb (err) {
        if (err) {
            ++errs;
            lastErr = err;
        }
        memMax = Math.max(memMax, process.memoryUsage().rss);
        if (!--times) {
            done(null, {
                time: Date.now() - start,
                mem: (memMax - memStart)/1024/1024,
                errors: errs,
                lastErr: lastErr ? lastErr.stack : null
            });
        }
    }
}


function report(err, res) {
    console.log(JSON.stringify(res));
}

if (args.file) {
    perf(args, function(err, res) {
        report(err, res);
        if (res.lastErr)
            console.error(res.lastErr);
    });
} else {
    var cp    = require('child_process')
    var async = require('async');
    var fs    = require('fs');
    var dir = __dirname + '/examples';

    var table = require('text-table');


    var files = args._.filter(function(f) {
        return !/^src-/.test(path.basename(f));
    });

    if (args.n)
        measure(files, args.n, args.t, function(err, res) {
            console.log("");
            console.log("results for", args.n, "parallel executions,",
                        args.t, "ms per I/O op");

            res.sort(function(r1, r2) {
                return parseFloat(r1.data.time) - parseFloat(r2.data.time)
            });
            console.log("");
            res = res.map(function(r) {
                var failText = 'N/A';
                if (r.data.timeout) failText = 'T/O';
                return [path.basename(r.file),
                    r.data.mem != null ? r.data.time: failText,
                    r.data.mem != null ? r.data.mem.toFixed(2) : failText]
            });

            res = [['file', 'time(ms)', 'memory(MB)']].concat(res)

            console.log(table(res, {align: ['l', 'r', 'r']}));
            printPlatform();

        });
    else {
        var measurements = (args.ns || '100,500,1000,1500,2000').split(',');
        async.mapSeries(measurements, function(n, done) {
            console.log("--- n =", n, "---");
            measure(files, n, args.t != null ? args.t : n * args.dt, function(err, res) {
                return done(null, {n: n, res: res});
            });
        }, function(err, all) {
            //structure:
            //[{n: n, res: [{ file: file, data: {time: time, mem: mem}}]}]
            var times = [], mems = [];
            for (var k = 0; k < all[0].res.length; ++k) {
                var file = all[0].res[k].file;
                // skip missing
                if (all[0].res[k].data.missing)
                    continue;
                var memf  = {label: path.basename(file), data: []};
                var timef = {label: path.basename(file), data: []};
                for (var n = 0; n < all.length; ++n) {
                    var requests = all[n].n,
                        time = all[n].res[k].data.time,
                        mem = all[n].res[k].data.mem;
                    timef.data.push([requests, time]);
                    memf.data.push( [requests, mem]);
                }
                times.push(timef);
                mems.push(memf);
            }
            console.log("--------- time ---------");
            console.log(util.inspect(times, false, 10))
            console.log("--------- mem ----------");
            console.log(util.inspect(mems,  false, 10))
        })
    }
}


function measure(files, requests, time, callback) {
    async.mapSeries(files, function(f, done) {
        console.log("benchmarking", f);

        var argsFork = [__filename,
            '--n', requests,
            '--t', time,
            '--file', f];
        if (args.harmony) argsFork.unshift('--harmony');
        if (args.longStackSupport) argsFork.push('--longStackSupport');

        var p = cp.spawn(process.execPath, argsFork);

        var complete = false, timedout = false;
        if (args.timeout) setTimeout(function() {
            if (complete) return;
            timedout = true;
            p.kill();
        }, args.timeout);

        var r = { file: f, data: [] };
        p.stdout.on('data', function(d) { r.data.push(d.toString()); });
        p.stdout.pipe(process.stdout);
        p.stdout.on('end', function(code) {
            complete = true;
            try {
                r.data = JSON.parse(r.data.join(''));
            } catch(e) {
                r.data = {time: Number.POSITIVE_INFINITY, mem: null,
                    missing: true, timeout: timedout};
            }
            done(null, r);
        });
    }, callback);
}
