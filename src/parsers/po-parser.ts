import { PortableObjectFile, PortableObjectToken, PortableObjectTokenIdentifier } from "../files/po-file";
import { TranslationFileParser } from "../translation-file-parser";
import { TranslatableTextMap } from "../translatable-text-map";
import { delay, findNext, naturalLanguageCompare } from "../utils";

export class PortableObjectParser implements TranslationFileParser {
    async parseFrom(fileContent: string): Promise<PortableObjectFile> {
        await delay(0, null);
        let portableObjectFile: PortableObjectFile = {
            tokens: []
        };
        if (fileContent) {
            portableObjectFile.tokens =
                fileContent.split('\n').map(
                    line => new PortableObjectToken(line));
        }
        return portableObjectFile;
    }

    toFileFormatted(instance: PortableObjectFile, defaultValue: string): string {
        return !!instance ? instance.tokens.map(t => t.line).join('\n') : defaultValue;
    }

    applyTranslations(
        portableObject: PortableObjectFile,
        translations: { [key: string]: string; } | undefined,
        ordinals: number[] | undefined): PortableObjectFile {
        //
        // Each translation has a named identifier (it's key), for example: { 'SomeKey': 'some translated value' }.
        // The ordinals map each key to it's appropriate translated value in the resource, for example: [2,0,1].
        // For each translation, we map its keys value to the corresponding ordinal.
        //
        if (portableObject && translations) {
            let lastIndex = 0;
            for (let key in translations) {
                const value = translations[key];
                if (value) {
                    lastIndex = findNext(
                        portableObject.tokens,
                        lastIndex,
                        token => !token.isInsignificant && token.id === 'msgid' && token.value === key,
                        token => !token.isInsignificant && token.id === 'msgstr',
                        token => token.value = value);
                }
            }
        }

        return portableObject;
    }

    toTranslatableTextMap(instance: PortableObjectFile): TranslatableTextMap {
        const textToTranslate: Map<string, string> = new Map();
        const tokens = instance.tokens;
        if (tokens && tokens.length) {
            const tryGetKeyValuePair = (batchedTokens: PortableObjectToken[]): { key: string, value: string } | undefined => {
                if (batchedTokens && batchedTokens.length) {
                    const key = this.findTokenValueById('msgid', batchedTokens);
                    const value = this.findTokenValueById('msgstr', batchedTokens);

                    return !!key && !!value ? { key, value } : undefined;
                }
                return undefined;
            };

            let index = 0;
            let [lastIndex, batch] = this.batchTokens(tokens, index);
            while (batch && lastIndex !== tokens.length) {
                let pair = tryGetKeyValuePair(batch);
                if (pair) {
                    textToTranslate.set(pair.key, pair.value);
                }
                [lastIndex, batch] = this.batchTokens(tokens, lastIndex);
            }
        }

        const translatableText: Map<string, string> = new Map();
        [...textToTranslate.keys()].sort((a, b) => naturalLanguageCompare(a, b)).forEach(key => {
            translatableText.set(key, textToTranslate.get(key)!);
        });

        const ordinals: number[] =
            [...translatableText.keys()].map(
                key => tokens.findIndex(t => t.value === key));

        return {
            text: translatableText,
            ordinals
        };
    }

    private batchTokens(tokens: PortableObjectToken[], index: number): [number, PortableObjectToken[]] {
        let batch: PortableObjectToken[] = [];
        let lastIndex = index;
        for (lastIndex; lastIndex < tokens.length; ++lastIndex) {
            const token = tokens[lastIndex];
            if (!token.isInsignificant) {
                batch.push(token);
            }
        }

        return [lastIndex, batch];
    }

    private findTokenValueById(tokenId: PortableObjectTokenIdentifier, tokens: PortableObjectToken[]): string | null | undefined {
        return tokens.find(t => t.id === tokenId)?.value;
    }
}