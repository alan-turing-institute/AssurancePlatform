---
sidebar_position: 3
title: "Changelog"
description: "Complete version history and release notes for the TEA Platform"
---

# Changelog

All notable changes to the TEA Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1](https://github.com/alan-turing-institute/AssurancePlatform/compare/v1.0.0...v1.0.1) (2026-01-18)

### 🔧 CI/CD

* disable semantic-release success/fail comments ([9316a64](https://github.com/alan-turing-institute/AssurancePlatform/commit/9316a64c4056a9156e83b073d54495bfc58dc52f))

## 1.0.0 (2026-01-18)

### ✨ Features

* add connected accounts section to settings page ([9a2f8f2](https://github.com/alan-turing-institute/AssurancePlatform/commit/9a2f8f210994ee82bd05aa16400579fbb42ca513))
* add GitHub import and OpenAPI documentation ([a798104](https://github.com/alan-turing-institute/AssurancePlatform/commit/a798104a4f6ee5d3223612bd80d4b0eed7e00460))
* add Google OAuth and Google Drive integration ([5666b45](https://github.com/alan-turing-institute/AssurancePlatform/commit/5666b45c1d8777030711faf2257e81da18de0911))
* add image export (SVG/PNG) for assurance case diagrams ([f0553e6](https://github.com/alan-turing-institute/AssurancePlatform/commit/f0553e644e13633c0733e6664adfb1f4bbcf59b0))
* add MarkdownExporter class for document export (aeb.3.5) ([3b582e1](https://github.com/alan-turing-institute/AssurancePlatform/commit/3b582e128e06aba77238cd55dd1b2b4a5f1ba343))
* add PDFExporter for document export (aeb.3.2) ([518f202](https://github.com/alan-turing-institute/AssurancePlatform/commit/518f2022c0659406b37ffdbccaabbdadd0f0c13a))
* add report template system for document export (aeb.3.6) ([3a79e4d](https://github.com/alan-turing-institute/AssurancePlatform/commit/3a79e4d759acec15c5c96255445ad9b807249de7))
* add WordExporter for Word document export (aeb.3.4) ([2406c70](https://github.com/alan-turing-institute/AssurancePlatform/commit/2406c707001e4ac6dea0867369c5205f625d71a9))
* build optimisation + fix entrypoint script ([ed0ca33](https://github.com/alan-turing-institute/AssurancePlatform/commit/ed0ca33b95389d1ef6dc1385298265bc92a77ac5))
* **devops:** add health check endpoint and improve CI/CD reliability ([e271a98](https://github.com/alan-turing-institute/AssurancePlatform/commit/e271a985459e661cff0b474fb917e4fe89371bc9))
* **docs:** restore detailed case studies and add two new ([5356393](https://github.com/alan-turing-institute/AssurancePlatform/commit/5356393c3c277059b7f746771f7c640d36a28e90))
* handle Django-to-Prisma baseline migration automatically ([e800b1a](https://github.com/alan-turing-institute/AssurancePlatform/commit/e800b1ab369360d06745274f385c72e8718b1fa0))
* implement backend API testing with comprehensive test suite ([ba98c1c](https://github.com/alan-turing-institute/AssurancePlatform/commit/ba98c1cca12f30b8b302f3625e8805cc94b5f2e5))
* implement recycle bin soft-delete system ([fba56de](https://github.com/alan-turing-institute/AssurancePlatform/commit/fba56dec1b106c69007128d0fd90e1dca87d3714))
* improve PDF/Markdown export formatting and add TEA branding ([8bbe8a6](https://github.com/alan-turing-institute/AssurancePlatform/commit/8bbe8a6c1d02b02a5386f98f7815ced5cc6cac1d))
* reorganise export modal and fix PDF/Markdown exports (aeb.3.7) ([782cc8e](https://github.com/alan-turing-institute/AssurancePlatform/commit/782cc8ed5a6c79f84db672f5e811b0472d6c7b28))
* support multiple evidence URLs per element ([27cc387](https://github.com/alan-turing-institute/AssurancePlatform/commit/27cc3877aa6d0bf8dfc35e08b5a248af480b11f9)), closes [#427](https://github.com/alan-turing-institute/AssurancePlatform/issues/427)

### 🐛 Bug Fixes

* add dummy DATABASE_URL for build-time Prisma initialization ([ac2a1cd](https://github.com/alan-turing-institute/AssurancePlatform/commit/ac2a1cdb61351dad106c7dfe1e35900362c26f31))
* add Google OAuth build args to Dockerfile ([f65cc42](https://github.com/alan-turing-institute/AssurancePlatform/commit/f65cc428335a02dc66a6d24c536625dd37281eb5))
* add Google OAuth build args to Dockerfile ([a00264f](https://github.com/alan-turing-institute/AssurancePlatform/commit/a00264f1d801733d3da63eeb2ff90d863d9b756b))
* add missing Case Studies tables to migration ([37ebd94](https://github.com/alan-turing-institute/AssurancePlatform/commit/37ebd94753096e192559a75acf92657dacc9b992))
* add prisma generate step before build in Dockerfile ([ed2a2c4](https://github.com/alan-turing-institute/AssurancePlatform/commit/ed2a2c4ec18cfbf2b8030f9a9790495de794f025))
* add prisma generate step before type-check in CI ([61d9776](https://github.com/alan-turing-institute/AssurancePlatform/commit/61d9776f76ee02b13226a417e161ebb84fb55756))
* **build:** replace isomorphic-dompurify with sanitize-html ([75f1514](https://github.com/alan-turing-institute/AssurancePlatform/commit/75f15146fb6aef6de4ce3e621a2ee9701c7deede))
* case throwing client error 696 ([a991264](https://github.com/alan-turing-institute/AssurancePlatform/commit/a991264d9e09366f235a8a7fea890ba344430fa9))
* Docker development environment API connectivity ([a16936e](https://github.com/alan-turing-institute/AssurancePlatform/commit/a16936e73f0b2b267052148ef9fffdb5865147c9))
* element descriptions can now be edited ([855f8ca](https://github.com/alan-turing-institute/AssurancePlatform/commit/855f8cad9005b0d5699ccfa7d3d9f9fd379855dd))
* emit SSE event after reset identifiers to trigger real-time UI update ([d2cc5ff](https://github.com/alan-turing-institute/AssurancePlatform/commit/d2cc5ff790e237a49cd0c72f262788342cb50ee4))
* exclude HTML files from auth middleware for domain verification ([52eda73](https://github.com/alan-turing-institute/AssurancePlatform/commit/52eda73dc6b27c196fa31cc50658132dbcecf230))
* exclude test files and vitest configs from build type checking ([a4f115b](https://github.com/alan-turing-institute/AssurancePlatform/commit/a4f115b33efaaf6abeb5091e09b1f8a345decee3))
* improve health check reliability in CI/CD ([e9995e5](https://github.com/alan-turing-institute/AssurancePlatform/commit/e9995e5a9a914a03c6f983bd67f2183546b881e6))
* install prisma locally for config module resolution ([96478de](https://github.com/alan-turing-institute/AssurancePlatform/commit/96478deff04a346706e0a10ac69919d674915e05))
* **lint:** configure biome exclusions and fix lint errors ([9068c21](https://github.com/alan-turing-institute/AssurancePlatform/commit/9068c2111ba3b9dae0ced54defd0974dd462a375))
* Password form ([93e38a0](https://github.com/alan-turing-institute/AssurancePlatform/commit/93e38a0d97e3f0424396ec9b4f457d4426beda1d))
* prevent shell interpretation of $ in webhook URLs ([2080420](https://github.com/alan-turing-institute/AssurancePlatform/commit/2080420fa5e35c22d4e909cfcfdc7e84a245133c))
* redeclare build args in builder stage ([820665d](https://github.com/alan-turing-institute/AssurancePlatform/commit/820665d61d189e22d78db3126ba056949cca55d9))
* redeclare build args in builder stage ([28c4f50](https://github.com/alan-turing-institute/AssurancePlatform/commit/28c4f501614fb53448ca5fac58328c5a5e30562e))
* remove legacy RefreshToken authentication system ([6d461d0](https://github.com/alan-turing-institute/AssurancePlatform/commit/6d461d00930ca7fc6f503433fbb3220f0368585c))
* remove use server directive from rate-limit-service ([3c3731a](https://github.com/alan-turing-institute/AssurancePlatform/commit/3c3731aa0ecc97c64a0b8800ea8174a9d0c73933))
* replace invalid 'primary' button variant with 'default' ([5c40589](https://github.com/alan-turing-institute/AssurancePlatform/commit/5c40589107e7a8d4f589791476d2a37c5d7a58c5))
* resolve all build-affecting type errors ([2821239](https://github.com/alan-turing-institute/AssurancePlatform/commit/2821239a68bb062524b7228aad96b3f18a1ee416))
* resolve CaseStudy type conflicts for build ([a7d6f06](https://github.com/alan-turing-institute/AssurancePlatform/commit/a7d6f064365cfcdf05680b628245608d929a0cba))
* resolve Word exporter styling issues ([acc8a9a](https://github.com/alan-turing-institute/AssurancePlatform/commit/acc8a9af3c57b48524cea0f985a118d33e314d8d))
* **security:** add proper HTML sanitisation to sanitizeDescription ([db86da2](https://github.com/alan-turing-institute/AssurancePlatform/commit/db86da2e32a3e563e4ded884c5745425b5eda0f4))
* **security:** address timing attack vulnerability in JWT callback ([45b4cfd](https://github.com/alan-turing-institute/AssurancePlatform/commit/45b4cfdc2cbcc4a7296bf86080be64783a013822))
* **security:** harden invite acceptance with transaction and audit logging ([f0ba447](https://github.com/alan-turing-institute/AssurancePlatform/commit/f0ba4471ee4b6afa985745ae8b818d5fd935b9ce))
* Shape detail was still expected ([67b9558](https://github.com/alan-turing-institute/AssurancePlatform/commit/67b955859fe7a205fdc5ee5ea6b4743e79a900da))
* skip data migration check when legacy tables already removed ([6d206dc](https://github.com/alan-turing-institute/AssurancePlatform/commit/6d206dc5cbe18acb8d0e8a6689226e28c8a2e145))
* state refresh for detach/reattach element operations ([74d2438](https://github.com/alan-turing-institute/AssurancePlatform/commit/74d2438f422c738f85b8fd8192d5b6fd4573a289)), closes [#1](https://github.com/alan-turing-institute/AssurancePlatform/issues/1) [#2](https://github.com/alan-turing-institute/AssurancePlatform/issues/2)
* sync section checkboxes with template selection in export modal ([1574a38](https://github.com/alan-turing-institute/AssurancePlatform/commit/1574a38aa2fae8e51056e0b03da21c0a3028164b))
* update delete modal text to reflect soft-delete behaviour ([db0036e](https://github.com/alan-turing-institute/AssurancePlatform/commit/db0036e4c2d44b13317e29a968e9db460fdb74e4))
* use require for node:stream in Google Drive service ([e958aef](https://github.com/alan-turing-institute/AssurancePlatform/commit/e958aefb3fba234a72751bccb8a6d875b7ba524c))
* websocket url ([3eef8d0](https://github.com/alan-turing-institute/AssurancePlatform/commit/3eef8d0ff680e9433644f6e75fa532e921da26e3))

### ⚡ Performance Improvements

* implement aeb.7 performance optimisations ([5381f14](https://github.com/alan-turing-institute/AssurancePlatform/commit/5381f1483b887bee614bc9d5d343872021f1c0e7))

### 📚 Documentation

* add data retention policy for inactive accounts ([fdc655e](https://github.com/alan-turing-institute/AssurancePlatform/commit/fdc655ef8f5c8007c87b543b959c26aeb6155b71))
* Cardlist and Card link Components ([04dff9b](https://github.com/alan-turing-institute/AssurancePlatform/commit/04dff9b15539f8e504b789a983062b1a64b79568))
* create .all-contributorsrc [skip ci] ([92d35ab](https://github.com/alan-turing-institute/AssurancePlatform/commit/92d35ab0d1966bf14e9daa4c37e8c846428674ab))
* Docker and NextAuth added ([844c5bc](https://github.com/alan-turing-institute/AssurancePlatform/commit/844c5bce5d0c02cb0c595d81498abc479e82eef7))
* ReactFlow and Tailwindcss ([50174f7](https://github.com/alan-turing-institute/AssurancePlatform/commit/50174f7f4739571eed642321416a88bb6b767a11))
* update .all-contributorsrc [skip ci] ([d2415db](https://github.com/alan-turing-institute/AssurancePlatform/commit/d2415db0c503023298f2f7b78d78b57ac74d27e0))
* update .all-contributorsrc [skip ci] ([e745339](https://github.com/alan-turing-institute/AssurancePlatform/commit/e745339cb32fbd6c6c6e90ad18993543f48da060))
* update .all-contributorsrc [skip ci] ([834fcc9](https://github.com/alan-turing-institute/AssurancePlatform/commit/834fcc9c80ea88ca96a3b14e859afe53bf41ff27))
* update .all-contributorsrc [skip ci] ([ba828db](https://github.com/alan-turing-institute/AssurancePlatform/commit/ba828db5a72507a66df8ba4265fd47912ba75f69))
* update .all-contributorsrc [skip ci] ([233be0e](https://github.com/alan-turing-institute/AssurancePlatform/commit/233be0e1b83e5f3b26c21956f1b7e057f3ac8b10))
* update .all-contributorsrc [skip ci] ([dd57b22](https://github.com/alan-turing-institute/AssurancePlatform/commit/dd57b220f4202ddd05708a93cba64898dc01b2ba))
* update .all-contributorsrc [skip ci] ([59b7bd4](https://github.com/alan-turing-institute/AssurancePlatform/commit/59b7bd4bae7784c15034c4141a33844ac2830857))
* update .all-contributorsrc [skip ci] ([4f0277f](https://github.com/alan-turing-institute/AssurancePlatform/commit/4f0277f8768fd18faa0d99b67d16c22e97b58656))
* update .all-contributorsrc [skip ci] ([553a9a2](https://github.com/alan-turing-institute/AssurancePlatform/commit/553a9a2887186e41c54453387e04841a36ec98e8))
* update .all-contributorsrc [skip ci] ([a0d0288](https://github.com/alan-turing-institute/AssurancePlatform/commit/a0d0288ccd3c805d3214f550cfc9b9c2b8fe2ea3))
* update .all-contributorsrc [skip ci] ([139a76f](https://github.com/alan-turing-institute/AssurancePlatform/commit/139a76f02a4f8330019d8aae3746cddf87950c40))
* update README.md [skip ci] ([ab27dc3](https://github.com/alan-turing-institute/AssurancePlatform/commit/ab27dc373a0a1ae30e74cef7d8930cc61458f4a2))
* update README.md [skip ci] ([fecfa4d](https://github.com/alan-turing-institute/AssurancePlatform/commit/fecfa4d45fe23e466c2ecb443f9e3551c23d0e8b))
* update README.md [skip ci] ([f6beef6](https://github.com/alan-turing-institute/AssurancePlatform/commit/f6beef609a80f8f135ff48fa7b6d98700398b2b3))
* update README.md [skip ci] ([269d4bf](https://github.com/alan-turing-institute/AssurancePlatform/commit/269d4bf47e92ed837bba12f6da3b597f24d43439))
* update README.md [skip ci] ([8c419c6](https://github.com/alan-turing-institute/AssurancePlatform/commit/8c419c62a044e66bdf7b630eabcb026ad01ef76d))
* update README.md [skip ci] ([de2275e](https://github.com/alan-turing-institute/AssurancePlatform/commit/de2275e635ebef4c5be8977cd306fcc2a9d8570b))
* update README.md [skip ci] ([5fac0a2](https://github.com/alan-turing-institute/AssurancePlatform/commit/5fac0a24aa0e29f16d986131348953dd6808cd3c))
* update README.md [skip ci] ([bd46a4a](https://github.com/alan-turing-institute/AssurancePlatform/commit/bd46a4ac4c3e8a8d87db642213537156fafb7f95))
* update README.md [skip ci] ([77d2cc0](https://github.com/alan-turing-institute/AssurancePlatform/commit/77d2cc012c258f6b62dd043fec365a34397f5edf))
* update README.md [skip ci] ([deb1a3a](https://github.com/alan-turing-institute/AssurancePlatform/commit/deb1a3aadd760493f5ea8f020ead628b7002e176))

### 💄 Styles

* pre-commit fixes ([8e77398](https://github.com/alan-turing-institute/AssurancePlatform/commit/8e77398fec67851e031754aeb89ee45d1f8ff3b2))
* pre-commit fixes ([bce25e1](https://github.com/alan-turing-institute/AssurancePlatform/commit/bce25e19317a48d5b2161e53478bb84b4d5f00fc))
* pre-commit fixes ([614d40e](https://github.com/alan-turing-institute/AssurancePlatform/commit/614d40eafbfd80b3e09f659570eee75f125f4e70))
* pre-commit fixes ([31a8225](https://github.com/alan-turing-institute/AssurancePlatform/commit/31a8225b7ce6991d41f6119e83beaf0b7cd2a186))
* pre-commit fixes ([0af6aca](https://github.com/alan-turing-institute/AssurancePlatform/commit/0af6aca87fbf298584e96cd421a56fb3a97e1c4b))
* pre-commit fixes ([43732ed](https://github.com/alan-turing-institute/AssurancePlatform/commit/43732ed2d2c45c595e7e2f9cbe526e6a9e39eae5))
* pre-commit fixes ([cfbbab9](https://github.com/alan-turing-institute/AssurancePlatform/commit/cfbbab9b436cdcc648c9f9c1b84a8a5c99981787))
* pre-commit fixes ([25ae2ff](https://github.com/alan-turing-institute/AssurancePlatform/commit/25ae2ff371887bcff0cf6c6c70dc65bb93a516fb))
* pre-commit fixes ([889172f](https://github.com/alan-turing-institute/AssurancePlatform/commit/889172f9c40e7621b9244ffe89d07af62ac8934f))
* pre-commit fixes ([52dd4fd](https://github.com/alan-turing-institute/AssurancePlatform/commit/52dd4fd6ab4de2f5c4ce2b7bea7b6172211f267b))
* pre-commit fixes ([1d992ca](https://github.com/alan-turing-institute/AssurancePlatform/commit/1d992cabea69d8845250223dd648c3c80f975acf))
* pre-commit fixes ([fa35c55](https://github.com/alan-turing-institute/AssurancePlatform/commit/fa35c5585e9964b8d727d4d9f98e8c74077f6d75))
* pre-commit fixes ([7301a76](https://github.com/alan-turing-institute/AssurancePlatform/commit/7301a760b584c92d421ca6915d9785a8344cab30))
* pre-commit fixes ([034fa46](https://github.com/alan-turing-institute/AssurancePlatform/commit/034fa466db0d175c7993deda48377382c51c1781))
* pre-commit fixes ([f42fc3c](https://github.com/alan-turing-institute/AssurancePlatform/commit/f42fc3c0dc0b944db54c3c27d7c24276dda9eb9e))
* pre-commit fixes ([73b70a6](https://github.com/alan-turing-institute/AssurancePlatform/commit/73b70a611858282407635b1e974a28e68fbaa3bd))
* pre-commit fixes ([1ee77c0](https://github.com/alan-turing-institute/AssurancePlatform/commit/1ee77c01e04754c80f35c090c5b99a0ad58d52b3))
* pre-commit fixes ([0b7652c](https://github.com/alan-turing-institute/AssurancePlatform/commit/0b7652c273459875334e43f901eeab9214588425))
* pre-commit fixes ([47f6e3b](https://github.com/alan-turing-institute/AssurancePlatform/commit/47f6e3b91866e6824b928fb5c75bb6f5cf507fc4))
* pre-commit fixes ([91339d0](https://github.com/alan-turing-institute/AssurancePlatform/commit/91339d03c3c33fe2f05d304e21f0be62287611ae))
* pre-commit fixes ([5fcf3eb](https://github.com/alan-turing-institute/AssurancePlatform/commit/5fcf3ebcdbb410bc4b09bd1f00b260326ca45360))
* pre-commit fixes ([59f19d4](https://github.com/alan-turing-institute/AssurancePlatform/commit/59f19d469e393d422dceb08a17ad63a9f14dcabb))
* pre-commit fixes ([464e898](https://github.com/alan-turing-institute/AssurancePlatform/commit/464e898a8e818258a149d39020d4eabfb8557be3))
* pre-commit fixes ([1f00373](https://github.com/alan-turing-institute/AssurancePlatform/commit/1f00373e4476f11fc89ddabc031f3fc2233a1352))
* pre-commit fixes ([60f2c7e](https://github.com/alan-turing-institute/AssurancePlatform/commit/60f2c7e4336c161c77d6476123cc1e54940dd687))
* pre-commit fixes ([916245c](https://github.com/alan-turing-institute/AssurancePlatform/commit/916245cc6b3260b576166875caad4ca768fafc40))
* pre-commit fixes ([06404cb](https://github.com/alan-turing-institute/AssurancePlatform/commit/06404cb2328f73784d0c4ade0810b84a32903d83))
* pre-commit fixes ([0f05594](https://github.com/alan-turing-institute/AssurancePlatform/commit/0f055948c6ba7e9fd099688d343561575698dc50))
* pre-commit fixes ([f0ec888](https://github.com/alan-turing-institute/AssurancePlatform/commit/f0ec888df68523617332f2b1f6b3b0dc37884f1c))
* pre-commit fixes ([b72ce8d](https://github.com/alan-turing-institute/AssurancePlatform/commit/b72ce8d9fb32104b8da4f653de10eb3f8a1a1a23))
* pre-commit fixes ([223b821](https://github.com/alan-turing-institute/AssurancePlatform/commit/223b821951e2f2ffa6c547658274c90450b8ad26))
* pre-commit fixes ([4cf792e](https://github.com/alan-turing-institute/AssurancePlatform/commit/4cf792ef7e76baa42375d10abcde2041bb278771))
* pre-commit fixes ([8341a9e](https://github.com/alan-turing-institute/AssurancePlatform/commit/8341a9e24421a68d6a4560ce257a95b73bb5d07a))
* pre-commit fixes ([acbc9b7](https://github.com/alan-turing-institute/AssurancePlatform/commit/acbc9b753a513ac0b534be08b51dbd8b72751202))
* pre-commit fixes ([61afc5c](https://github.com/alan-turing-institute/AssurancePlatform/commit/61afc5c298dd0126ef2d6b10aea300aec2528559))
* pre-commit fixes ([3fda87c](https://github.com/alan-turing-institute/AssurancePlatform/commit/3fda87c760c6e08804a26a3c127b6ada4605c13f))
* pre-commit fixes ([7f4d27c](https://github.com/alan-turing-institute/AssurancePlatform/commit/7f4d27c920593a691004e63767184179b0bb0ad5))
* pre-commit fixes ([c5fb290](https://github.com/alan-turing-institute/AssurancePlatform/commit/c5fb290ddf6bb866158d45da8a7f1df22a8f7bd4))
* pre-commit fixes ([e5f6cfe](https://github.com/alan-turing-institute/AssurancePlatform/commit/e5f6cfe2dd28788f260bc9249632e4a05fdcc863))
* pre-commit fixes ([52e30d6](https://github.com/alan-turing-institute/AssurancePlatform/commit/52e30d6d3e130bc0c2fd41c631675423ddd2663a))
* pre-commit fixes ([e15a5f9](https://github.com/alan-turing-institute/AssurancePlatform/commit/e15a5f9a0cb30f72e5ea0a4d88d8a76730c92abd))
* pre-commit fixes ([5f270c5](https://github.com/alan-turing-institute/AssurancePlatform/commit/5f270c5fb4a51a21f1049c357bfba0e7c7a19d41))
* pre-commit fixes ([728f2d0](https://github.com/alan-turing-institute/AssurancePlatform/commit/728f2d008adfcf7520ae1b7946d875d61670cafd))
* pre-commit fixes ([74a4d23](https://github.com/alan-turing-institute/AssurancePlatform/commit/74a4d23d54cbd3ce306799c1d7286f8fea9bd16b))
* pre-commit fixes ([af0280a](https://github.com/alan-turing-institute/AssurancePlatform/commit/af0280a980286a0c2e91c23c3634042affb80051))
* pre-commit fixes ([19e84b9](https://github.com/alan-turing-institute/AssurancePlatform/commit/19e84b9f7285209759c5938ee0b7c209c959f2a2))
* pre-commit fixes ([bd3791c](https://github.com/alan-turing-institute/AssurancePlatform/commit/bd3791c33e8f7869f7bfadfcb66cf2244bc77101))
* pre-commit fixes ([d9464de](https://github.com/alan-turing-institute/AssurancePlatform/commit/d9464de3fd1345408f754301133d593d0042461e))
* pre-commit fixes ([ace4565](https://github.com/alan-turing-institute/AssurancePlatform/commit/ace4565e5773e334a79f29d554615f489b750c49))
* pre-commit fixes ([2e1e141](https://github.com/alan-turing-institute/AssurancePlatform/commit/2e1e1412ba21c80673e6cf7d4f93c9f8b78495e0))
* pre-commit fixes ([70af472](https://github.com/alan-turing-institute/AssurancePlatform/commit/70af472be6b45862966dde05566518eaccf3d733))
* pre-commit fixes ([c04b14f](https://github.com/alan-turing-institute/AssurancePlatform/commit/c04b14fd4da2a428077a8a8b2d2b021ec28cba67))
* pre-commit fixes ([ffbdb2b](https://github.com/alan-turing-institute/AssurancePlatform/commit/ffbdb2b502a9f961a4f9a7ca3d9f7ddf8fa0cd53))
* pre-commit fixes ([7c3fe46](https://github.com/alan-turing-institute/AssurancePlatform/commit/7c3fe46492d3afd7cc3bc3a5fb513a95c3e58910))
* pre-commit fixes ([21aad9e](https://github.com/alan-turing-institute/AssurancePlatform/commit/21aad9e63bd1d44d4dc17893239d253c7a602539))
* pre-commit fixes ([d04b4ec](https://github.com/alan-turing-institute/AssurancePlatform/commit/d04b4ecd94b39e00a3198d4adccb160ab60597cc))
* pre-commit fixes ([6a54d11](https://github.com/alan-turing-institute/AssurancePlatform/commit/6a54d1196abc9b8b1ce77a70cc253afb060e5586))
* pre-commit fixes ([7184a4e](https://github.com/alan-turing-institute/AssurancePlatform/commit/7184a4eb22a385c9d220c35561c20cfae27cfb43))
* pre-commit fixes ([1e21118](https://github.com/alan-turing-institute/AssurancePlatform/commit/1e2111812d9ea8593e1a1b3616e046004def2d5d))
* pre-commit fixes ([e11541f](https://github.com/alan-turing-institute/AssurancePlatform/commit/e11541f4f26f483aaed4c0a844f38db32a949ded))
* pre-commit fixes ([4b89e35](https://github.com/alan-turing-institute/AssurancePlatform/commit/4b89e35a781883e8df1258763ae74f9aee6c7ee7))
* pre-commit fixes ([4802eb7](https://github.com/alan-turing-institute/AssurancePlatform/commit/4802eb708ccc5524b6f081e118c8445fc9afb53a))
* pre-commit fixes ([5e7f49b](https://github.com/alan-turing-institute/AssurancePlatform/commit/5e7f49b423dc96143579e8f6ad7fc165015b48ca))
* pre-commit fixes ([d6bb92c](https://github.com/alan-turing-institute/AssurancePlatform/commit/d6bb92c32f5d069b000f3fe902c9987bd23f82b7))
* pre-commit fixes ([19747ef](https://github.com/alan-turing-institute/AssurancePlatform/commit/19747ef7ed0ed7a47e2fe5cf6a9c6c59c4cc5152))
* pre-commit fixes ([1c0cc89](https://github.com/alan-turing-institute/AssurancePlatform/commit/1c0cc8903f6d973af508a18f49b24bfbb6ae74f3))
* pre-commit fixes ([f3c0e03](https://github.com/alan-turing-institute/AssurancePlatform/commit/f3c0e0314f9162a6975967e60b6efdf6babc8125))
* pre-commit fixes ([c322128](https://github.com/alan-turing-institute/AssurancePlatform/commit/c32212828301c90781876da506e08aad96deb3d5))
* pre-commit fixes ([56bcda1](https://github.com/alan-turing-institute/AssurancePlatform/commit/56bcda1b7cb6d9ca395b40ebd5d8a89ed4796d31))
* pre-commit fixes ([db282ea](https://github.com/alan-turing-institute/AssurancePlatform/commit/db282ead6019759fc2a129917629740f28cfdb7e))
* pre-commit fixes ([80f7e34](https://github.com/alan-turing-institute/AssurancePlatform/commit/80f7e340ebfc8e1986c3750c2f50ad7f429b4811))
* pre-commit fixes ([c3165f8](https://github.com/alan-turing-institute/AssurancePlatform/commit/c3165f876df8bb3b10774e11bfef1cd204264e73))
* pre-commit fixes ([af116da](https://github.com/alan-turing-institute/AssurancePlatform/commit/af116da959cf330701c75686d5f609837aa0c958))
* pre-commit fixes ([fe8f93a](https://github.com/alan-turing-institute/AssurancePlatform/commit/fe8f93a66f26f114666191c3b6b940d428e02787))
* pre-commit fixes ([f0c9c6d](https://github.com/alan-turing-institute/AssurancePlatform/commit/f0c9c6d994e4d8be65be01f25050c422d6348d8c))
* pre-commit fixes ([456fd53](https://github.com/alan-turing-institute/AssurancePlatform/commit/456fd53a6d30d57ee7bf9eea19dbe9f847144cd2))
* pre-commit fixes ([a5c7e36](https://github.com/alan-turing-institute/AssurancePlatform/commit/a5c7e3698c72e5d82c51b62864b8ef93a60f33cb))
* pre-commit fixes ([45cf176](https://github.com/alan-turing-institute/AssurancePlatform/commit/45cf176a06eb103bcba71b7eb35d87d1377e3711))
* pre-commit fixes ([ea7501e](https://github.com/alan-turing-institute/AssurancePlatform/commit/ea7501eb679f3d094b9b31cb46619d34a5df4373))
* pre-commit fixes ([f3b4e53](https://github.com/alan-turing-institute/AssurancePlatform/commit/f3b4e53a2191a81e13448334ceb8d28c62589612))
* pre-commit fixes ([4fca194](https://github.com/alan-turing-institute/AssurancePlatform/commit/4fca194eeaee5450eea670ca17645d754adc7498))
* pre-commit fixes ([e2ed34a](https://github.com/alan-turing-institute/AssurancePlatform/commit/e2ed34a05917f931dad97a0ee1c649becd6d666a))
* pre-commit fixes ([7e9d77b](https://github.com/alan-turing-institute/AssurancePlatform/commit/7e9d77b9e8e0bd1efdf8f20c90fe4018bedb8d37))
* pre-commit fixes ([8d5a372](https://github.com/alan-turing-institute/AssurancePlatform/commit/8d5a3721ac8e246c110bf7ec43f6b0f388eca273))
* pre-commit fixes ([f1f0891](https://github.com/alan-turing-institute/AssurancePlatform/commit/f1f0891d21be9e1cd8f837dc26253e73184289c4))
* pre-commit fixes ([f7345d1](https://github.com/alan-turing-institute/AssurancePlatform/commit/f7345d11cf838587e1f02ac7c721115c8429a89b))
* pre-commit fixes ([2c58064](https://github.com/alan-turing-institute/AssurancePlatform/commit/2c5806454baa2c507248b78e90fd8cee9d13713a))
* pre-commit fixes ([341f38b](https://github.com/alan-turing-institute/AssurancePlatform/commit/341f38b79f834331d6de61b5f03560554cb317b4))
* pre-commit fixes ([b9146a8](https://github.com/alan-turing-institute/AssurancePlatform/commit/b9146a8e039984f927baf1fc8b11d377e1a09971))
* pre-commit fixes ([e251b04](https://github.com/alan-turing-institute/AssurancePlatform/commit/e251b040c41bd7063eef00a1da56cbb47b93c778))
* pre-commit fixes ([21262e6](https://github.com/alan-turing-institute/AssurancePlatform/commit/21262e6d96d1b67239ba888534b945387857f398))
* pre-commit fixes ([71b845f](https://github.com/alan-turing-institute/AssurancePlatform/commit/71b845ffc29aa5a4956a3ac541e8f9f9125b392b))
* pre-commit fixes ([00d861d](https://github.com/alan-turing-institute/AssurancePlatform/commit/00d861d1681c629a66ffcc954419b67f12ffd272))
* pre-commit fixes ([200e257](https://github.com/alan-turing-institute/AssurancePlatform/commit/200e2574e8f9e2c51da8072770604b4c7dbacd5a))
* pre-commit fixes ([f148e17](https://github.com/alan-turing-institute/AssurancePlatform/commit/f148e1793348a4ceaedb9ca0c3cb40298fc920a7))
* pre-commit fixes ([10e9a99](https://github.com/alan-turing-institute/AssurancePlatform/commit/10e9a999c3d48ea7a7921e2d7cffd66fe4be1382))
* pre-commit fixes ([7426f39](https://github.com/alan-turing-institute/AssurancePlatform/commit/7426f395db291284c25212293c8eb8cf5c63c35e))
* pre-commit fixes ([b43ae29](https://github.com/alan-turing-institute/AssurancePlatform/commit/b43ae29316ec33aaad8ee7db1d92704e20ebad3d))
* pre-commit fixes ([619c807](https://github.com/alan-turing-institute/AssurancePlatform/commit/619c807aa7fe1f500db82f83fb3f6185ea6b1b95))
* pre-commit fixes ([c576c1f](https://github.com/alan-turing-institute/AssurancePlatform/commit/c576c1fddfc709306712c67287d27c22b59d9159))
* pre-commit fixes ([dc43e80](https://github.com/alan-turing-institute/AssurancePlatform/commit/dc43e80b2ab4399e653c20ac25073745a3a0b75b))
* pre-commit fixes ([7156056](https://github.com/alan-turing-institute/AssurancePlatform/commit/7156056e342079cf935b56f3ce265e45743aed9a))
* pre-commit fixes ([a90b56b](https://github.com/alan-turing-institute/AssurancePlatform/commit/a90b56b2f05636e4680fad01765f560c6dc2740a))
* pre-commit fixes ([46f9296](https://github.com/alan-turing-institute/AssurancePlatform/commit/46f9296fec0e7050be653e8a9ec89758d5d10ad7))
* pre-commit fixes ([2de0876](https://github.com/alan-turing-institute/AssurancePlatform/commit/2de08760dfcbf79364c49162830c41a28bf257e0))

### 🔧 CI/CD

* add semantic-release workflow and fix changelog docs ([beca77d](https://github.com/alan-turing-institute/AssurancePlatform/commit/beca77d64eb77947e46742da552c6211ae801045))
* use RELEASE_TOKEN for semantic-release branch protection bypass ([51669d2](https://github.com/alan-turing-institute/AssurancePlatform/commit/51669d2f69436d28ac7023bb170f5ae825c6eb04))

## [Unreleased]

### Added
- TEA Platform refactoring plan for modernising infrastructure
- Comprehensive versioning and release strategy documentation
- GitHub Container Registry migration strategy

### Changed
- Planning migration from Docker Hub to GitHub Container Registry (ghcr.io)
- Directory naming conventions from EAP to TEA branding

## [0.2.0] - TBD

### Added
- Semantic versioning implementation
- Automated release process via GitHub Actions
- Container image tagging with semantic versions

### Changed
- Updated from EAP (Ethical Assurance Platform) to TEA (Trustworthy and Ethical Assurance) branding
- Migrated container registry from Docker Hub to GitHub Container Registry

### Technical
- Directory structure: `eap_backend/` → `tea_backend/`, `next_frontend/` → `tea_frontend/`
- Container images: `turingassuranceplatform/eap_*` → `ghcr.io/alan-turing-institute/tea-platform/*`
- Improved CI/CD pipeline with GitHub-managed authentication

## [0.1.0] - Historical

### Added
- Initial TEA Platform release
- Django backend with REST API
- Next.js frontend with ReactFlow integration
- Basic Docker containerization
- Azure App Service deployment
- PostgreSQL database support
- GitHub OAuth authentication

### Technical
- Django 5.1.11 backend
- Next.js 15 frontend with React 19
- Docker Hub container hosting
- Azure App Service hosting
- Basic CI/CD pipeline

---

## Release Types

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
- **Technical** for infrastructure and development changes
