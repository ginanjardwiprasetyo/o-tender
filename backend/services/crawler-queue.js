const crypto = require('crypto');

class CrawlerQueue {
    constructor() {
        this.tasks = [];
        this.pendingResolvers = new Map();
    }

    queueTaskAndWait(taskPayload, timeoutMs = 120000) {
        return new Promise((resolve, reject) => {
            const taskId = crypto.randomUUID();
            
            const timeout = setTimeout(() => {
                this.pendingResolvers.delete(taskId);
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                reject(new Error('Extension scrape timeout. Is Chrome Extension running and polling?'));
            }, timeoutMs);

            this.pendingResolvers.set(taskId, { resolve, reject, timeout });
            
            this.tasks.push({
                id: taskId,
                ...taskPayload
            });
        });
    }

    popTask() {
        if (this.tasks.length > 0) {
            return this.tasks.shift();
        }
        return null;
    }

    submitResult(taskId, data) {
        const resolver = this.pendingResolvers.get(taskId);
        if (resolver) {
            clearTimeout(resolver.timeout);
            this.pendingResolvers.delete(taskId);
            if (data && data.error) {
                resolver.reject(new Error(data.error));
            } else {
                resolver.resolve(data);
            }
            return true;
        }
        return false;
    }
}

module.exports = new CrawlerQueue();
