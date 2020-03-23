'use strict';
let config = { watch: [] };
let app = null, coll_star;
const fs = require('fs');
const events = {
    async push(body) {
        let resp = 'Recent commit to {0}{1} by {2}'.translate().format(body.repository.full_name, body.ref == 'refs/heads/master' ? '' : ':' + body.ref, body.pusher.name);
        for (let commit of body.commits) {
            let det = [];
            if (commit.added.length) det.push(`${commit.added.length}+`);
            if (commit.removed.length) det.push(`${commit.removed.length}-`);
            if (commit.modified.length) det.push(`${commit.modified.length}M`);
            resp += `\n${commit.id.substr(0, 6)} ${commit.message.replace(/\n/g, ' ')} (${det.join(' ')})`;
        }
        return resp;
    },
    async issues(body) {
        let resp;
        if (body.action == 'opened') {
            resp = '{0} opened an issue for {1}#{2}'.translate().format(body.issue.user.login, body.repository.full_name, body.issue.number);
            resp = resp + '\n' + body.issue.title;
        } else if (body.action == 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += '\n' + body.comment.body;
        } else if (body.action == 'assigned') {
            resp = '{0}#{1}: Assigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action == 'unassigned') {
            resp = '{0}#{1}: Unassigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action == 'closed') {
            resp = '{0} closed {1}#{2}.'.translate().format(body.sender.login, body.repository.full_name, body.issue.number);
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = '{0} {1} Issue:{2}#{3}'.translate().format(body.sender.login, body.action, body.repository.full_name, body.issue.number);
        } else resp = 'Unknwon issue action: {0}'.translate().format(body.action);
        return resp;
    },
    async issue_comment(body) {
        let resp;
        if (body.action == 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += '\n' + body.comment.body;
        }
        return resp;
    },
    async pull_request(body) {
        let resp;
        if (body.action == 'opened') {
            resp = '{0} opened an pull request for {1}#{2}'.translate().format(body.issue.user.login, body.repository.full_name, body.issue.number);
            resp = resp + '\n' + body.issue.title;
        } else if (body.action == 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += '\n' + body.comment.body;
        } else if (body.action == 'assigned') {
            resp = '{0}#{1}: Assigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action == 'unassigned') {
            resp = '{0}#{1}: Unassigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action == 'review_requested') {
            resp = '{0}#{1}: Request a review'.translate().format(body.repository.full_name, body.issue.number);
        } else if (body.action == 'closed' && !body.merged) {
            resp = '{0} closed {1}#{2}.'.translate().format(body.sender.login, body.repository.full_name, body.issue.number);
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = '{0} {1} PR:{2}#{3}'.translate().format(body.sender.login, body.action, body.repository.full_name, body.issue.number);
        } else resp = 'Unknwon pull request action: {0}'.translate().format(body.action);
        return resp;
    },
    async watch(body) {
    },
    async star(body) {
        if (body.action == 'created') {
            if (coll_star)
                if (await coll_star.findOne({ user: body.sender.login, repo: body.repository.full_name }))
                    return;
            await coll_star.insertOne({ user: body.sender.login, repo: body.repository.full_name });
            return '{0} starred {1} (total {2} stargazers)'.translate().format(body.sender.login, body.repository.full_name, body.repository.stargazers_count);
        }
    },
    async check_run(body) {
    },
    async check_suite(body) {
    },
    async status(body) {
        return;
        let resp = '{0}:{1} {2}'.translate().format(body.context, body.state, body.repository.full_name);
        return resp + '\n' + body.description;
    }
};
exports.init = function (item) {
    app = item.app;
    config = item.config;
    if (item.db) coll_star = item.db.collection('github_event_star');
    else console.warn('Use MongoDB for full features');
    item.router.post('/github', async ctx => {
        try {
            let event = ctx.request.headers['x-github-event'], body;
            if (typeof ctx.request.body.payload == 'string') body = JSON.parse(ctx.request.body.payload);
            else body = ctx.request.body;
            if (!events[event])
                events[event] = body => `${body.repository.full_name} triggered an unknown event: ${event}`;
            let reponame = body.repository.full_name;
            let cnt = 0;
            let message = await events[event](body);
            if (message)
                for (let groupId of config.watch[reponame]) {
                    app.sender.sendGroupMsgAsync(groupId, message);
                    cnt++;
                }
            ctx.body = `Pushed to ${cnt} group(s)`;
        } catch (e) {
            console.log(e);
            ctx.body = e.toString();
        }
    });
};
async function _add({ meta }, repo) {
    if (config.watch[repo]) config.watch[repo].push(meta.groupId);
    else config.watch[repo] = [meta.groupId];
    meta.$send(`Watching ${repo}
(You have to create a webhook to http://2.masnn.io:6701/github for your repo.)`);
}
exports.apply = ({ app }) => {
    app.command('repo.add <repo>', '监听一个Repository的事件').action(_add);
};