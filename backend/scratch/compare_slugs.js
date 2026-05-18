const axios = require('axios');

async function check(slug) {
    const url = `https://spse.inaproc.id/${slug}/lelang`;
    try {
        const res = await axios.get(url, { timeout: 10000 });
        return res.status;
    } catch (e) {
        return e.response ? e.response.status : 999;
    }
}

async function run() {
    console.log('jateng:', await check('jateng'));
    console.log('jatengprov:', await check('jatengprov'));
    console.log('jabar:', await check('jabar'));
    console.log('jabarprov:', await check('jabarprov'));
    console.log('dkijakarta:', await check('dkijakarta'));
    console.log('jakarta:', await check('jakarta'));
}

run();
