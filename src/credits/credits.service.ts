import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreditsService {
  constructor(private readonly configService: ConfigService) {}

  async getEscavadorCredits() {
    const instance = axios.create({
      baseURL: this.configService.getOrThrow<string>('ESCAVADOR_BASE_URL'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.configService.getOrThrow<string>(
          'ESCAVADOR_ACCESS_KEY',
        )}`,
      },
    });

    const response = await instance.get('/v1/quantidade-creditos');
    return response.data;
  }
}
