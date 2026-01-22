import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PeopleService } from './people.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('legal-cases')
  async legalCases(@Query() legalCasesDto: any) {
    return this.peopleService.legalCases(legalCasesDto);
  }

  @Post('legal-cases/excel')
  @UseInterceptors(FileInterceptor('file'))
  async legalCasesExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('email') email: string,
  ) {
    if (!file) {
      throw new HttpException('Arquivo não enviado', 400);
    }

    if (!email) {
      throw new HttpException('Email não enviado', 400);
    }

    return this.peopleService.legalCasesExcel(file, email);
  }
}
