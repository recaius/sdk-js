'use strict'

class NeedLoginError extends Error {
    constructor() {
        let message = 'Need login'
        super(message);
        this.message = message;
        this.name = 'NeedLoginError';
    }
}
class RequireArgumentError extends Error {
    constructor(msg) {
        let message = `Require argument: ${msg}`
        super(message);
        this.message = message;
        this.name = 'RequireArgumentError';
    }
}

class NotStartedError extends Error {
    constructor() {
        let message = 'ASR not started'
        super(message);
        this.message = message;
        this.name = 'NotStartedError';
    }
}

class TimeoutError extends Error {
    constructor() {
        let message = 'Timeout'
        super(message);
        this.message = message;
        this.name = 'TimeoutError';
    }
}

module.exports = {
    NeedLoginError: NeedLoginError,
    RequireArgumentError: RequireArgumentError,
    NotStartedError: NotStartedError,
    TimeoutError: TimeoutError
}
