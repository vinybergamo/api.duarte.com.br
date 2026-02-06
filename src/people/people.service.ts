import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { milliseconds } from 'date-fns';
import axios from 'axios';
import * as XLSX from 'xlsx';
import * as nodemailer from 'nodemailer';

const DOCUMENT_TYPE_MAPPER = {
  FISICA: 'BR:CPF',
  JURIDICA: 'BR:CNPJ',
};

@Injectable()
export class PeopleService {
  constructor(
    @InjectRedis() private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {}

  private get escavadorApi() {
    return axios.create({
      baseURL: this.configService.getOrThrow<string>('ESCAVADOR_BASE_URL'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.configService.getOrThrow<string>(
          'ESCAVADOR_ACCESS_KEY',
        )}`,
      },
    });
  }

  async legalCases(legalCasesDto: any) {
    const data = await this.fetchLegalCases(legalCasesDto.document);

    if (!data) {
      return {
        person: null,
        resume: {
          casesCount: 0,
          trabalhistasCasesCount: 0,
          civelCasesCount: 0,
          federalCasesCount: 0,
          otherCasesCount: 0,
        },
        raw: data,
      };
    }

    const trabalhistasCases = data.items.filter((item) =>
      item.unidade_origem.tribunal_sigla.startsWith('TRT'),
    );
    const civelCases = data.items.filter((item) =>
      item.unidade_origem.tribunal_sigla.startsWith('TJ'),
    );
    const federalCases = data.items.filter(
      (item) =>
        item.unidade_origem.tribunal_sigla.startsWith('TRF') ||
        item.unidade_origem.tribunal_sigla.startsWith('Federal'),
    );
    const otherCases = data.items.filter(
      (item) =>
        !item.unidade_origem.tribunal_sigla.startsWith('TRT') &&
        !item.unidade_origem.tribunal_sigla.startsWith('TJ') &&
        !item.unidade_origem.tribunal_sigla.startsWith('TRF') &&
        !item.unidade_origem.tribunal_sigla.startsWith('Federal'),
    );

    return {
      person: {
        name: data.envolvido_encontrado.nome,
        document: {
          type: DOCUMENT_TYPE_MAPPER[data.envolvido_encontrado.tipo_pessoa],
          number: legalCasesDto.document,
        },
      },
      resume: {
        casesCount: data.envolvido_encontrado.quantidade_processos,
        trabalhistasCasesCount: trabalhistasCases.length,
        civelCasesCount: civelCases.length,
        federalCasesCount: federalCases.length,
        otherCasesCount: otherCases.length,
      },
      raw: data,
    };
  }

  async legalCasesExcel(file: Express.Multer.File, email: string) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<{
      Nome: string;
      Gênero: string;
      CPF: string;
      'Validade certificado digital': string;
      Cooperativa: string;
      Email: string;
      Celular: string;
      'Dt nascimento': string;
      Estado: string;
      Cidade: string;
      'Nº conselho': string;
      Profissão: string;
      'Região de atendimento': string;
      'Status do processo seletivo': string;
      'Usuário vinculado': string;
    }>(worksheet, {
      range: 3,
    });

    const people = data.map((person) => {
      return {
        name: person.Nome,
        document: {
          type: 'BR:CPF',
          number: person.CPF,
        },
      };
    });

    const legalCases = await Promise.all(
      people.map((person) =>
        this.safeLegalCasesForExcel(person.document.number),
      ),
    );

    const filteredLegalCases = legalCases.filter(
      (person) => person && person.person,
    );

    const excelToSave = filteredLegalCases.map((person) => {
      if (!person || !person.person) {
        return;
      }
      return {
        Nome: person.person.name,
        Documento: person.person.document.number.replace(/\D/g, ''),
        'Quantidade de processos': person.resume.casesCount,
        'Quantidade de processos trabalhistas':
          person.resume.trabalhistasCasesCount || 0,
        'Quantidade de processos civis': person.resume.civelCasesCount || 0,
        'Quantidade de processos federais':
          person.resume.federalCasesCount || 0,
        'Quantidade de processos outros': person.resume.otherCasesCount || 0,
      };
    });

    const excelBuffer = this.generateExcelFile(excelToSave);

    this.sendToEmail(email, excelBuffer);

    return {
      message: 'Arquivo enviado com sucesso',
      result: excelToSave,
    };
  }

  private generateExcelFile(data: any) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
    const buffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });
    return buffer;
  }

  private async sendToEmail(email: string, buffer: Buffer) {
    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: this.configService.getOrThrow<number>('SMTP_PORT'),
      secure: this.configService.getOrThrow<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });

    const mailOptions = {
      from: this.configService.getOrThrow<string>('SMTP_USER'),
      to: email,
      subject: 'Relatório de processos',
      attachments: [
        {
          filename: `relatorio-processos-${Date.now()}.xlsx`,
          content: buffer,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  }

  private async fetchLegalCases(personDocument: string) {
    const document = personDocument.replace(/\D/g, '');
    const cacheKey = `cache:people:${document}:legal-cases`;

    const cachedData = await this.redisClient.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const data = await this.getLegalCasesFromApi(document);

    if (!data.envolvido_encontrado) {
      return null;
    }

    await this.redisClient.set(
      cacheKey,
      JSON.stringify(data),
      'PX',
      milliseconds({
        days: 180,
      }),
    );

    return data;
  }

  private async getLegalCasesFromApi(document: string) {
    try {
      const response = await this.escavadorApi.get(`/v2/envolvido/processos`, {
        params: {
          cpf_cnpj: document,
          limit: 100,
        },
      });

      let data = response.data;
      let items = [...data.items];
      let nextLink = data.links?.next;

      while (nextLink) {
        const nextResponse = await this.escavadorApi.get(nextLink);
        const nextData = nextResponse.data;
        items.push(...nextData.items);
        nextLink = nextData.links?.next;
      }

      return {
        envolvido_encontrado: data.envolvido_encontrado,
        items,
      };
    } catch (error) {
      throw new HttpException(
        error?.response?.data || error?.message || 'Erro ao buscar processos',
        error.response.status,
      );
    }
  }

  private async safeLegalCasesForExcel(document: string) {
    try {
      return await this.legalCases({ document });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || '';

      if (
        message.toLowerCase().includes('saldo') ||
        message.toLowerCase().includes('insuficiente')
      ) {
        return null;
      }

      throw error;
    }
  }
}
