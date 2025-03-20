import { BasicTLVParser, SchemaParser } from "@aokiapp/tlv-parser";
import {
  schemaCertificate,
  schemaKenhojoBasicFour,
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

const kenhojoMyNumberParsed = BasicTLVParser.parse(kenhojoMyNumber.buffer);
console.log("=== KENHOJO MY NUMBER DATA ===");
console.log(kenhojoMyNumberParsed.value);
console.log("=== KENHOJO MY NUMBER DATA ===");

const kenhojoBasicFourParser = new SchemaParser(schemaKenhojoBasicFour);
console.log("=== KENHOJO BASIC FOUR DATA ===");
console.log(kenhojoBasicFourParser.parse(kenhojoBasicFour.buffer));
console.log("=== KENHOJO BASIC FOUR DATA ===");

const kenhojoSignatureParser = new SchemaParser(schemaKenhojoSignature);
console.log("=== KENHOJO SIGNATURE DATA ===");
console.log(kenhojoSignatureParser.parse(kenhojoSignature.buffer));
console.log("=== KENHOJO SIGNATURE DATA ===");

const kenhojoCertificateParser = new SchemaParser(schemaCertificate);
kenhojoCertificateParser
  .parse(kenhojoCertificate.buffer, { async: true })
  .then((parsed) => {
    console.log("=== KENHOJO CERTIFICATE DATA ===");
    console.log(parsed);
    console.log("=== KENHOJO CERTIFICATE DATA ===");
  });

const kenkakuEntriesParser = new SchemaParser(schemaKenkakuEntries);
kenkakuEntriesParser
  .parse(kenkakuEntries.buffer, { async: true })
  .then((parsed) => {
    console.log("=== KENKAKU ENTRIES DATA ===");
    console.log(parsed);
    console.log("=== KENKAKU ENTRIES DATA ===");
  });

const kenkakuMyNumberParser = new SchemaParser(schemaKenkakuMyNumber);
kenkakuMyNumberParser
  .parse(kenkakuMyNumber.buffer, { async: true })
  .then((parsed) => {
    console.log("=== KENKAKU MY NUMBER DATA ===");
    console.log(parsed);
    console.log("=== KENKAKU MY NUMBER DATA ===");
  });
