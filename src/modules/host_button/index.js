import $ from 'jquery';
import settings from '../../settings.js';
import watcher from '../../watcher.js';
import twitch from '../../utils/twitch.js';
import twitchAPI from '../../utils/twitch-api.js';
import domObserver from '../../observers/dom.js';

const FOLLOW_BUTTON_CONTAINER_SELECTOR = '.follow-btn__notification-toggle-container';
const HOST_BUTTON_ID = 'bttv-host-button';

let $hostButton;
let hosting = false;
let currentChannelId;
let removeShareButtonListener;

const buttonTemplate = `
  <div class="bttvHostButtonWrapper">
    <button id="${HOST_BUTTON_ID}">
      <span class="buttonText">Host Channel</span>
    </button>
  </div>
`;

class HostButtonModule {
  constructor() {
    settings.add({
      id: 'hostButton',
      name: 'Host Button',
      defaultValue: false,
      description: 'Adds a Host/Unhost button below the video player',
    });
    settings.on('changed.hostButton', (value) => (value === true ? this.load() : this.unload()));
    watcher.on('load.chat', () => this.load());
    watcher.on('load.channel', () => this.load());
  }

  load() {
    if (settings.get('hostButton') === false) return;

    const currentUser = twitch.getCurrentUser();
    if (!currentUser) return;

    const currentChannel = twitch.getCurrentChannel();
    const channelId = currentChannel && currentChannel.id;
    if (!channelId || currentUser.id === channelId || currentChannelId === channelId) return;
    currentChannelId = channelId;

    if (!$hostButton) {
      $hostButton = $(buttonTemplate);
      $hostButton.find('button').click(() => this.toggleHost());
    }
    removeShareButtonListener = domObserver.on(
      `.channel-info-content ${FOLLOW_BUTTON_CONTAINER_SELECTOR}, ${FOLLOW_BUTTON_CONTAINER_SELECTOR}`,
      (node, isConnected) => {
        if (!isConnected) return;
        this.embedHostButton();
      }
    );
    this.updateHostingState(currentUser.id, channelId);
  }

  embedHostButton() {
    if ($(`#${HOST_BUTTON_ID}`).length) return;
    const $followButtonContainer = $(FOLLOW_BUTTON_CONTAINER_SELECTOR);
    if (!$followButtonContainer.length) return;
    if ($followButtonContainer.hasClass('follow-btn__notification-toggle-container--visible')) {
      $hostButton.insertAfter($followButtonContainer);
    } else {
      $hostButton.insertBefore($followButtonContainer);
    }
  }

  toggleHost() {
    const currentUser = twitch.getCurrentUser();
    if (!currentUser) return;

    const command = hosting ? 'unhost' : 'host';
    try {
      const channelName = twitch.getCurrentChannel().name;
      const rawMessage = `PRIVMSG #${currentUser.name} :/${command === 'host' ? `${command} ${channelName}` : command}`;
      twitch.getChatServiceSocket().send(rawMessage);
      hosting = !hosting;
      this.updateHostButtonText();
      twitch.sendChatAdminMessage(`BetterTTV: We sent a /${command} to your channel.`);
    } catch (e) {
      twitch.sendChatAdminMessage(`
                BetterTTV: There was an error ${command}ing the channel.
                You may need to ${command} it from your channel.
            `);
    }
  }

  updateHostingState(userId, channelId) {
    const query = `
            query ChannelHosting {
                currentUser {
                    hosting {
                        id
                    }
                }
            }
        `;

    return twitchAPI.graphqlQuery(query).then(
      ({
        data: {
          currentUser: {hosting: newHosting},
        },
      }) => {
        hosting = newHosting && newHosting.id.toString() === channelId;
        this.updateHostButtonText();
      }
    );
  }

  updateHostButtonText() {
    const text = hosting ? 'Unhost Channel' : 'Host Channel';
    $hostButton.find('span').text(text);
  }

  unload() {
    if (removeShareButtonListener) removeShareButtonListener();
    if ($hostButton) $hostButton.remove();
    currentChannelId = null;
  }
}

export default new HostButtonModule();
