const
    fs = require('fs'),
    path = require('path');
exports.exec = async args => {
    let res = fs.readdirSync(path.resolve(__dirname, args));
    for (let i in res)
        if (typeof res[i] == 'string' && res[i].endsWith('.js')) res[i] = res[i].replace('.js', '');
    return res.join(' ');
}