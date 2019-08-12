import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

import { YoutrackIssueAppStorage } from './YoutrackIssueAppStorage';

export class YoutrackIssueAppCommand implements ISlashCommand {
    public command = 'youtrack-issue';
    public i18nParamsExample = 'youtrackParams';
    public i18nDescription = 'youtrackDescription';
    public providesPreview = false;
    private hostYoutrackPM = 'https://youtrack-pm.theinvaders.pro/';
    private res;

    // tslint:disable-next-line:max-line-length
    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        switch (context.getArguments().length) {
            case 0:
                return await this.invalidUsageHandler(context, modify);
            case 1:
                return await this.handleStatusArgOnly(context, read, modify, http, persis);
            default:
                return await this.handleWithCustomMessage(context, read, modify, http, persis);
        }
    }

    private async invalidUsageHandler(context: SlashCommandContext, modify: IModify): Promise<void> {
        await this.sendNotifyMessage(context, modify, 'Invalid usage of the Youtrack command. ' +
            'Please provide whether you are `start` or `stop`, with the message optional if you are away.');
    }

    // tslint:disable-next-line:max-line-length
    private async handleStatusArgOnly(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const data: YoutrackIssueAppStorage = {
            out: true,
            // tslint:disable-next-line:max-line-length
            message: '',
        };

        switch (context.getArguments()[0].toLowerCase()) {
            case 'start':
                await persis.removeByAssociation(assoc);
                this.res = await http.get(`${ this.hostYoutrackPM }/youtrack_issue_start?id=${ context.getSender().id }`);
                if (this.res.statusCode === 200) {
                    return await this.sendNotifyMessage(
                        context, modify, `${JSON.parse(this.res.content)["data"]["massage"]}, ${context.getSender().username}!`);
                }
                return await this.sendNotifyMessage(
                    context, modify, `Bot @bot_youtrack is error, ${context.getSender().username}!`);
            case 'stop':
                await persis.createWithAssociation(data, assoc);
                this.res = await http.get(`${ this.hostYoutrackPM }/youtrack_issue_stop?id=${ context.getSender().id }`);
                if (this.res.statusCode === 200) {
                    return await this.sendNotifyMessage(
                        context, modify, `${JSON.parse(this.res.content)["data"]["massage"]}, ${context.getSender().username}!`);
                }
                return await this.sendNotifyMessage(
                        context, modify, `Bot @bot_youtrack is error, ${context.getSender().username}!`);
            case 'status':
                this.res = await http.get(`${ this.hostYoutrackPM }/youtrack_issue_status?id=${ context.getSender().id }`);
                if (this.res.statusCode === 200) {
                    return await this.sendNotifyMessage(
                        context, modify, `${JSON.parse(this.res.content)["data"]["massage"]}, ${context.getSender().username}!`);
                }
                return await this.sendNotifyMessage(
                    context, modify, `Bot @bot_youtrack is error, ${context.getSender().username}!`);
            default:
                return await this.sendNotifyMessage(context, modify,
                    'No idea what you are talking about. ' +
                    'Only `start`, `stop`, `status` are accepted options for the first argument.');
        }
    }

    // tslint:disable-next-line:max-line-length
    private async handleWithCustomMessage(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const action = context.getArguments()[0].toLowerCase();

        if (action === 'start' || action === 'stop' || action === 'status' || action === 'token') {
            return await this.handleStatusArgOnly(context, read, modify, http, persis);
        } else if (action !== 'token') {
            return await this.sendNotifyMessage(context, modify,
                'No idea what you are talking about. ' +
                'Only `start`, `stop` and `status` are accepted options for the first argument.');
        }

        const args = Array.from(context.getArguments());
        args.splice(0, 1); // Removing the action
        const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const data: YoutrackIssueAppStorage = {
            out: true,
            message: args.join(' '),
        };

        // Allow setting their status again if they're currently marked as away
        const existing = await read.getPersistenceReader().readByAssociation(assoc);
        if (existing.length > 0) {
            await persis.removeByAssociation(assoc);
        }

        await persis.createWithAssociation(data, assoc);

        return await this.sendNotifyMessage(context, modify,
            'You are marked as *Youtrack*, we will see you when you get back. ' +
            'The message being sent to others when they contact you is: "' +
            data.message + '"');
    }

    private async sendNotifyMessage(context: SlashCommandContext, modify: IModify, text: string): Promise<void> {
        const msg = modify.getCreator().startMessage().setText(text)
            .setUsernameAlias('Youtrack').setEmojiAvatar(':calendar:')
            .setRoom(context.getRoom()).setSender(context.getSender()).getMessage();

        return await modify.getNotifier().notifyUser(context.getSender(), msg);
    }
}
