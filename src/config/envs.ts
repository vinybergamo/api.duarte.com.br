import { config } from 'dotenv';
import envVar from 'env-var';

config({
  path: `.env.${process.env.APP_ENV || 'local'}`,
  debug: process.env.NODE_ENV !== 'production',
  quiet: true,
});

export const envs = {
  escavador: {
    baseUrl: envVar.get('ESCAVADOR_BASE_URL').required().asString(),
    accessToken: envVar.get('ESCAVADOR_ACCESS_KEY').required().asString(),
  },
};
