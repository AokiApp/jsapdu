import { TLVParser } from "@aokiapp/interface/tlv";
import {
  schemaCertificate,
  schemaKenhojoBasicFour,
  schemaKenhojoMyNumber,
  schemaKenhojoSignature,
  schemaKenkakuEntries,
  schemaKenkakuMyNumber,
} from "./schema";
import {
  kenhojoBasicFour,
  kenhojoCertificate,
  kenhojoMyNumber,
  kenhojoSignature,
  kenkakuEntries,
  kenkakuMyNumber,
} from "./constantPrivate";

const kenhojoMyNumberParser = new TLVParser(schemaKenhojoMyNumber);
const kenhojoMyNumberParsed = kenhojoMyNumberParser.parse(kenhojoMyNumber);
console.log(kenhojoMyNumberParsed);

const kenhojoBasicFourParser = new TLVParser(schemaKenhojoBasicFour);
const kenhojoBasicFourParsed = kenhojoBasicFourParser.parse(kenhojoBasicFour);
console.log(kenhojoBasicFourParsed);

const kenhojoSignatureParser = new TLVParser(schemaKenhojoSignature);
const kenhojoSignatureParsed = kenhojoSignatureParser.parse(kenhojoSignature);
console.log(kenhojoSignatureParsed);

const kenhojoCertificateParser = new TLVParser(schemaCertificate);
const kenhojoCertificateParsed =
  kenhojoCertificateParser.parse(kenhojoCertificate);
console.log(kenhojoCertificateParsed);

const kenkakuEntriesParser = new TLVParser(schemaKenkakuEntries);
const kenkakuEntriesParsed = kenkakuEntriesParser.parse(kenkakuEntries);
console.log(kenkakuEntriesParsed);

const kenkakuMyNumberParser = new TLVParser(schemaKenkakuMyNumber);
const kenkakuMyNumberParsed = kenkakuMyNumberParser.parse(kenkakuMyNumber);
console.log(kenkakuMyNumberParsed);
