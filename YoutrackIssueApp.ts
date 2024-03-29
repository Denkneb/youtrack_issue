import {
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';

import { YoutrackIssueAppStorage } from './YoutrackIssueAppStorage';
import { YoutrackIssueAppCommand } from './YoutrackIssueAppCommand';

export class YoutrackIssueApp extends App implements IPostMessageSent {
    public async checkPostMessageSent(message: IMessage, read: IRead, http: IHttp): Promise<boolean> {
        // We don't auto-respond to rooms beside direct messages
        // maybe in the future if the user is tagged by someone
        // then they will be direct messaged but right now it is
        // only direct messages
        this.getLogger().log(message.room.type, RoomType.DIRECT_MESSAGE);
        return message.room.type === RoomType.DIRECT_MESSAGE;
    }

    public async executePostMessageSent(message: IMessage, read: IRead,
                                        http: IHttp, persistence: IPersistence): Promise<void> {
        const otherUsers = message.room.usernames.filter((u) => u !== message.sender.username);
        if (otherUsers.length !== 1) {
            // We don't care if there isn't one other person in the room
            return;
        }

        const otherUser = await read.getUserReader().getByUsername(otherUsers[0]);
        const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, otherUser.id);

        const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
        if (awayDatas.length === 0) {
            // The user is not marked as away
            return;
        }

        const data = awayDatas[0] as YoutrackIssueAppStorage;
        const msg = read.getNotifier().getMessageBuilder().setText(otherUser.username +
            ' is currently *youtrack*, however they left the following message:\n\n>' +
            data.message)
            .setUsernameAlias('Youtrack').setEmojiAvatar(':calendar:')
            .setRoom(message.room).setSender(message.sender).getMessage();

        await read.getNotifier().notifyUser(message.sender, msg);

        this.getLogger().log(otherUser.username +
            ' is currently *youtrack*, however they left the following message:\n\n>"' + data.message + '"');
    }

    protected async extendConfiguration(configuration: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
        await configuration.slashCommands.provideSlashCommand(new YoutrackIssueAppCommand());
    }
}
