import { TLVParser } from "@aokiapp/tlv-parser/tlv";
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

const kenhojoBasicFourParser = new TLVParser(schemaKenhojoBasicFour);
kenhojoBasicFourParser.parse(kenhojoBasicFour).then((parsed) => {
  console.log(parsed);
});

const kenhojoSignatureParser = new TLVParser(schemaKenhojoSignature);
kenhojoSignatureParser.parse(kenhojoSignature).then((parsed) => {
  console.log(parsed);
});

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
