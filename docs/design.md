# CDツール検討

## 課題

以下を満たすツールが欲しい。
ステップを大きく3つに分けて要件を列挙する。
- バージョン算出
  - alphaバージョンやrcバージョンを出し分けることが出来る(MUST)
  - Release Noteも自動生成してくれる(SHOULD)
  - [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/)から、[semantic-versioning](https://semver.org/lang/ja/)に則ったバージョンアップが可能(OPTIONAL)
- バージョン適用
  - 言語に応じてビルドバージョンも更新する(SHOULD)
- バージョンリリース
  - 各言語の主要なレジストリに加え、Container Registryにも対応(MUST)

- 上記3つに共通する要件
  - モノレポに対応している(MUST)
  - 複数言語対応(SHOULD)
    - 例えば、モノレポでtsとrustのプロジェクトが混在していても対応可能であってほしい。

これまでは[cs-tools](https://www.npmjs.com/package/@procube/cs-tools)をCDに用いていた。

採用していた理由は以下
類似のメジャーなライブラリである[release-it](https://github.com/release-it/release-it)を比較対象として挙げた場合、
- メンテナがチームにいる
- 導入、運用が簡単
- CDのGithub Actionsの自動生成
- CLIによるversion up commitのpush
  - これにより、protected branchでもversion upを難なく可能。
  - release-itのようなGithub Actions上でversion upを行い、pushする場合ではprotected branchへのcommit pushが難しい。

ただ、今回対応するべき要件として
- 安定版、rc版の他の用途に用いるバージョンリリース
- モノレポへの対応

が必要となったため、cs-toolsでは対応が難しくなった。

## 技術選定

まず1つの案として、以下のようなcs-toolsを拡張したライブラリを自作するのはあり。
- バージョン算出はコマンドを拡張する
  - yarn start-pr --tag alpha など
- モノレポ対応は設定ファイルを追加し、それを読み込むようにする
  - 流石に過剰だが、雰囲気としては[release-pleaseのconfigファイル](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#configfile)みたいな感じ
- Container Registry対応についても、上記configファイルで可能
- 他のSHOULD要件も対応可能なはず

自作したとして、実装工数は大してかからない想定。

※これはあくまでCDツールの検討で、並列、差分ビルドなどはモノレポ管理(turborepo, lernaなど)でユーザーが自由に選択する領域なので、評価に入れない。

まず、最初の段階から候補から外したライブラリも念のため列挙する。

- [standard-version](https://github.com/conventional-changelog/standard-version)
  - 2年前からメンテされておらず、今回の要件ともそれほどマッチしない
- [semantic-release](https://semantic-release.gitbook.io/semantic-release)
  - モノレポに公式で対応していない
    - pluginはあるが、starが少なく、メンテもされていない
    - https://github.com/pmowrer/semantic-release-monorepo
    - https://github.com/RimacTechnology/semantic-release-monorepo
    - https://github.com/MeltStudio/melt-semantic-release-monorepo
- [auto](https://intuit.github.io/auto/index)
  - メンテが停滞気味
  - 少しnpmで触ってみたが、nodeのdeprecatedログが結構出る
  - 名前が汎用的なせいか記事などが全く検索にヒットしない
- [bazel](https://bazel.build/?hl=ja)
  - ほぼ[これ](https://engineering.linecorp.com/ja/blog/line-bazel)

### バージョン算出ステップ

**上記cs-tools拡張**

- Pros
  - 要件ほぼ全てに対応可能
- Cons
  - 工数が他ツールに比べてかかる。3人日くらい？

**release-it**

[github](https://github.com/release-it/release-it)

- Pros
  - pluginが豊富
  - monorepoにも一応対応している…？
    - https://github.com/release-it/release-it/blob/main/docs/recipes/monorepo.md
- Cons
  - 

参考記事
- [release-itとGitHub ActionsによってNode.jsパッケージのリリース作業を自動化する](https://qiita.com/ljourm/items/ee24b318908a8773677b)

**GitVersion**

[公式ドキュメント](https://gitversion.net/)

- Pros
  - 複数のブランチ戦略に対応(https://gitversion.net/docs/reference/configuration)
  - Conventional Commitsに対応可能(https://gitversion.net/docs/reference/version-increments#conventional-commit-messages)
- Cons
  - モノレポ非対応(https://github.com/GitTools/GitVersion/issues/2441#issuecomment-786649142)
  - 各言語毎のバージョン管理フィールドは手動書き換えが必要(https://gitversion.net/docs/learn/how-it-works)
  - 設定ファイルが膨大

**release-please**

[github](https://github.com/googleapis/release-please)

- Pros
  - 複数言語に対してビルドバージョンも自動アップデート可能
  - Conventional Commits対応。Release Noteも自動生成
  - モノレポ対応
- Cons
  - 複雑なブランチ戦略には対応していない
  - リリースの度にPRが作成されるのをマージしなければならない
  - トランクベース開発フローを対象としているが、現在のプロダクトとの相性が悪い
  - 少しメンテが停滞気味か…？(2025/5/3時点で最新のcommitが2025/3/12)

**Nx**

[公式ドキュメント](https://nx.dev/getting-started/intro)

- Pros
  - もちろんmonorepo対応
  - 一応prereleaseには対応している(https://nx.dev/nx-api/nx/documents/release#options)
- Cons
  - 求めているユースケースに対してライブラリが巨大

**Lerna**

[公式ドキュメント](https://lerna.js.org/)

- Pros
  - 
- Cons
  - 求めているユースケースに対してライブラリが巨大

**Turborepo**

[公式ドキュメント](https://turborepo.com/)

- Pros
  - 
- Cons
  - 

**@microsoft/rush**

- Pros
  - 
- Cons
  - スター数がnx,lerna,turborepoに比べて1/4以下

## 参考記事
- [モノレポについて調べるスクラップ](https://zenn.dev/seya/scraps/d6f0ee60fd0eea)
- [Semantic Versioningの闇](https://knqyf263.hatenablog.com/entry/2020/11/10/224424)
- [LernaとGithub Actionsでmonorepoライブラリのリリースを楽にする](https://link-and-motivation.hatenablog.com/entry/2022/11/16/190305)
- [npm-compare.com](https://npm-compare.com/ja-JP/lerna,nx,turbo)
  - 評価結果はAI生成なので同じ結果は見られないと思うが
