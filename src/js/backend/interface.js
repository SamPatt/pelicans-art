/**
 * Backend interface contract for server/browser modes.
 * This file is documentation-only (JSDoc), no runtime exports required.
 * @typedef {Object} Backend
 * @property {() => Promise<Array<{name:string,description?:string}>>} listSprites
 * @property {(name:string, variant:string) => Promise<string>} getSprite
 * @property {(name:string) => Promise<string[]>} detectVariants
 * @property {(name:string) => Promise<Object>} getSpriteMeta
 * @property {(name:string, svg:string, meta:Object) => Promise<void>} saveSprite
 * @property {(name:string, variant:string, svg:string) => Promise<void>} saveSpriteVariant
 * @property {(name:string) => Promise<void>} deleteSprite
 * @property {() => Promise<Array<{name:string,orientations?:string[]}>>} listBackgrounds
 * @property {(name:string, orientation:string) => Promise<string>} getBackground
 * @property {(name:string) => Promise<string[]>} detectBgOrientations
 * @property {(name:string, orientation:string, svg:string) => Promise<void>} saveBackground
 * @property {(name:string) => Promise<void>} deleteBackground
 * @property {() => Promise<Array<{name:string,description?:string}>>} listProps
 * @property {(name:string) => Promise<{name:string,svg:string,meta?:Object}>} getProp
 * @property {(name:string, svg:string, meta:Object) => Promise<void>} saveProp
 * @property {(name:string) => Promise<void>} deleteProp
 * @property {() => Promise<Array<{id:string,title?:string}>>} listSkits
 * @property {(id:string) => Promise<Object>} getSkit
 * @property {(id:string|null, data:Object) => Promise<string>} saveSkit
 * @property {(id:string) => Promise<void>} deleteSkit
 * @property {(request:Object) => Promise<Object>} generateAsset
 * @property {(skitId:string) => Promise<Object>} publishSkit
 * @property {(skitId:string) => Promise<Object>} getPublished
 * @property {(text:string, voiceConfig:Object|string) => Promise<Blob|void>} previewTts
 * @property {(voiceName:string, text:string) => Promise<Blob|void>} previewCustomVoice
 * @property {(voiceName:string, text:string) => Promise<Blob|void>} previewCustomVoiceWav
 * @property {() => Promise<Array>} listVoices
 * @property {(payload:Object) => Promise<Object>} importVoice
 * @property {(name:string) => Promise<Blob>} getVoiceFile
 * @property {(name:string) => Promise<Blob>} getVoiceWav
 * @property {(formData:FormData) => Promise<Object>} analyzeAudio
 * @property {(payload:Object) => Promise<Object>} processVoice
 * @property {(name:string, winner:string) => Promise<void>} finalizeVoice
 * @property {(type:string, name:string, variant?:string) => Promise<string>} getAssetUrl
 * @property {boolean} supportsVoiceCreation
 * @property {(callback:(msg:Object)=>void) => void} onUpdate
 * @property {() => void} disconnect
 */
