'use strict';

// Zego Token04 generator - server-side only. Keeps ServerSecret out of client (VAPT).
// Based on https://github.com/ZEGOCLOUD/zego_server_assistant (token/nodejs/server)

const crypto = require('crypto');

function RndNum(a, b) {
  return Math.ceil((a + (b - a) * Math.random()));
}

function makeRandomIv() {
  const str = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += str.charAt(Math.floor(Math.random() * str.length));
  }
  return result;
}

function getAlgorithm(keyBuffer) {
  switch (keyBuffer.length) {
    case 16: return 'aes-128-cbc';
    case 24: return 'aes-192-cbc';
    case 32: return 'aes-256-cbc';
    default: throw new Error('Invalid key length: ' + keyBuffer.length);
  }
}

function aesEncrypt(plainText, key, iv) {
  const cipher = crypto.createCipheriv(getAlgorithm(key), key, iv);
  cipher.setAutoPadding(true);
  const encrypted = cipher.update(plainText, 'utf8');
  const final = cipher.final();
  return Buffer.concat([encrypted, final]);
}

/**
 * Generate Token04 for Zego (room login + stream publish).
 * @param {number} appId - Zego App ID
 * @param {string} userId - User ID
 * @param {string} secret - Server secret (32-byte string)
 * @param {number} effectiveTimeInSeconds - Token TTL in seconds
 * @param {string} payload - JSON payload e.g. {"room_id":"x","privilege":{"1":1,"2":1},"stream_id_list":null}
 * @returns {string} Token04 string
 */
function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload) {
  if (!appId || typeof appId !== 'number') {
    throw Object.assign(new Error('appID invalid'), { errorCode: 1 });
  }
  if (!userId || typeof userId !== 'string') {
    throw Object.assign(new Error('userId invalid'), { errorCode: 3 });
  }
  const secretBuf = Buffer.from(secret, 'utf8');
  if (!secret || secretBuf.length !== 32) {
    throw Object.assign(new Error('secret must be a 32 byte string'), { errorCode: 5 });
  }
  if (typeof effectiveTimeInSeconds !== 'number' || effectiveTimeInSeconds <= 0) {
    throw Object.assign(new Error('effectiveTimeInSeconds invalid'), { errorCode: 6 });
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: RndNum(-2147483648, 2147483647),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || ''
  };
  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const ivBuf = Buffer.from(iv, 'utf8');
  const encryptBuf = aesEncrypt(plainText, secretBuf, ivBuf);

  const b1 = Buffer.allocUnsafe(8);
  const b2 = Buffer.allocUnsafe(2);
  const b3 = Buffer.allocUnsafe(2);
  b1.writeBigInt64BE(BigInt(tokenInfo.expire), 0);
  b2.writeUInt16BE(ivBuf.length, 0);
  b3.writeUInt16BE(encryptBuf.length, 0);

  const buf = Buffer.concat([b1, b2, ivBuf, b3, encryptBuf]);
  return '04' + buf.toString('base64');
}

module.exports = { generateToken04 };
