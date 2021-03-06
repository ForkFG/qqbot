const axios = require('axios');
const { svg2png } = require('../utils');

async function _tex({ meta }, message) {
    const tex = message.trim();
    if (!tex) return meta.$send('请输入要渲染的 LaTeX 代码。');
    let { data: svg } = await axios.get(`https://www.zhihu.com/equation?tex=${tex}`);
    const text = svg.match(/>([^<]+)<\/text>/);
    if (text) return meta.$send(text[1]);
    const viewBox = svg.match(/ viewBox="0 (-?\d*(.\d+)?) -?\d*(.\d+)? -?\d*(.\d+)?" /);
    if (viewBox) svg = svg.replace('\n', `\n<rect x="0" y="${viewBox[1]}" width="100%" height="100%" fill="white"></rect>\n`);
    return meta.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
}

exports.apply = (app) => {
    app.command('tex <code...>', 'KaTeX 渲染')
        .alias('katex <code...>')
        .usage('渲染器由 https://www.zhihu.com/equation 提供。')
        .action(_tex);
};
