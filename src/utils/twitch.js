import dayjs from 'dayjs';
import Config from '~/utils/config.js';
import Utils from '~/utils/index.js';
import logging from '~/utils/logging.js';

class Twitch {
	async getTwitchInfo (access_token) {
		try {
			const client_id = await this.getClientID();

			access_token = access_token || await this.getAccessToken();

			const json = await Utils.getAsJSON('https://api.twitch.tv/helix/users', {
				headers: {
					'Authorization': `Bearer ${access_token}`,
					'Client-ID': client_id,
				},
			});

			return json?.data[0];
		}
		catch (error) {
			logging.error(error);
			return error;
		}
	}

	async getBroadcasterID () {
		const { data } = await Config.getTwitchData();

		return data.id;
	}

	async getClientID () {
		const { client_id } = await Config.getTwitchData();

		return client_id;
	}

	async updateTwitchData (access_token, refresh_token, expires_in) {
		const expires_at = dayjs().add(expires_in, 'seconds');

		await Config.updateTwitchData({
			access_token,
			refresh_token,
			expires_at,
		}, await this.getTwitchInfo(access_token));
	}

	async getAccessToken (force_renew = false) {
		const { access_token, refresh_token, expires_at, client_id, client_secret } = await Config.getTwitchData();

		if (!access_token || !refresh_token || !expires_at) return null;

		if (dayjs().isBefore(expires_at) && !force_renew) return access_token;

		try {
			const url = new URL('https://id.twitch.tv/oauth2/token');
			url.searchParams.set('grant_type', 'refresh_token');
			url.searchParams.set('refresh_token', refresh_token);
			url.searchParams.set('client_id', client_id);
			url.searchParams.set('client_secret', client_secret);

			const json = await Utils.postAsJSON(url, {
				headers: {
					'Client-ID': client_id,
				},
			});

			const {
				access_token: new_access_token,
				refresh_token: new_refresh_token,
				expires_in: new_expires_in,
			} = json;

			if (!new_access_token || !new_refresh_token || !new_expires_in) return;

			await this.updateTwitchData(new_access_token, new_refresh_token, new_expires_in);

			return new_access_token;
		}
		catch (error) {
			logging.error('There was an error in updating the Twitch token');
			logging.error(error);
			logging.error();
		}
	}

	async getGameByData ({ id, name, igdb_id }) {
		try {
			const client_id = await this.getClientID();
			const access_token = await this.getAccessToken();

			const searchObject = {};
			if (id) searchObject.id = id;
			if (name) searchObject.name = name;
			if (igdb_id) searchObject.igdb_id = igdb_id;

			const queryString = new URLSearchParams(searchObject);

			const json = await Utils.getAsJSON(`https://api.twitch.tv/helix/games?${queryString}`, {
				headers: {
					'Authorization': `Bearer ${access_token}`,
					'Client-ID': client_id,
				},
			});

			return json.data;
		}
		catch (error) {
			logging.error(error);
			return error;
		}
	}

	async updateChannelInformation ({ title, game_id }) {
		try {
			const client_id = await this.getClientID();
			const access_token = await this.getAccessToken();
			const broadcaster_id = await this.getBroadcasterID();

			const { title_replacement } = await Config.getConfig();

			const json = await Utils.patchAsJSON(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcaster_id}`, {
				headers: {
					'Authorization': `Bearer ${access_token}`,
					'Client-ID': client_id,
				},
				body: JSON.stringify({
					title: title_replacement.replace('{{videoTitle}}', title),
					game_id,
				}),
			});

			return json;
		}
		catch (error) {
			logging.error(error);
			return error;
		}
	}
}

export default new Twitch();