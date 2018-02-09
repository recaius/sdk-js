try {
    module.exports = require('../test-config')
} catch (e) {
    module.exports = {
        url: process.env.CI_TEST_URL,
        version: process.env.CI_TEST_API_VERSION,
        proxy: undefined,
        auth: {
            speech_recog_jaJP: {
                service_id: process.env.CI_TEST_ASR_JA_ID,
                password: process.env.CI_TEST_ASR_JA_PASS
            },
            speech_recog_enUS: {
                service_id: process.env.CI_TEST_ASR_EN_ID,
                password: process.env.CI_TEST_ASR_EN_PASS
            },
            speech_recog_zhCN: {
                service_id: process.env.CI_TEST_ASR_ZH_ID,
                password: process.env.CI_TEST_ASR_ZH_PASS
            },
            speech_synthesis: {
                service_id: process.env.CI_TEST_TTS_ID,
                password: process.env.CI_TEST_TTS_PASS
            },
            machine_translation: {
                service_id: process.env.CI_TEST_MT_ID,
                password: process.env.CI_TEST_MT_PASS
            },
            knowledge_explorer: {
                service_id: process.env.CI_TEST_IIP_ID,
                password: process.env.CI_TEST_IIP_PASS,
            },
        }
    }
}
