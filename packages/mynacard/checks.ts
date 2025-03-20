import { SchemaParser, TLVParser } from "@aokiapp/tlv-parser";
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
kenhojoMyNumberParser.parse(kenhojoMyNumber).then((parsed) => {
  console.log(parsed);
});

const kenhojoBasicFourParser = new SchemaParser(schemaKenhojoBasicFour);
console.log(kenhojoBasicFourParser.parse(kenhojoBasicFour.buffer));

const kenhojoSignatureParser = new SchemaParser(schemaKenhojoSignature);
console.log(kenhojoSignatureParser.parse(kenhojoSignature.buffer));

const kenhojoCertificateParser = new TLVParser(schemaCertificate);
kenhojoCertificateParser.parse(kenhojoCertificate).then((parsed) => {
  console.log(parsed);
});

const kenkakuEntriesParser = new TLVParser(schemaKenkakuEntries);
kenkakuEntriesParser.parse(kenkakuEntries).then((parsed) => {
  console.log(parsed);
});

const kenkakuMyNumberParser = new TLVParser(schemaKenkakuMyNumber);
kenkakuMyNumberParser.parse(kenkakuMyNumber).then((parsed) => {
  console.log(parsed);
});
