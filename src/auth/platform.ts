export async function getPlatformLoginCode() {
  const provider = window.WeihudaPlatform?.login;
  if (provider) return provider();
  if (import.meta.env.DEV) return `web-draft-${window.crypto.randomUUID()}`;
  throw new Error("当前环境未提供微信登录能力，请在微信内重新打开。");
}

declare global {
  interface Window {
    WeihudaPlatform?: {
      login: () => Promise<string>;
    };
  }
}
