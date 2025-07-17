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
  - リリースステップをgithub actionsに切り出しているので、ユーザーごとのカスタマイズが容易
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

※これはあくまでCDツールの検討で、並列、差分ビルドなどはモノレポ管理(turborepo, lernaなど)でユーザーが自由に選択する領域なので、評価に入れない。その観点で、CDツールとしてNx, Lerna, Turborepoなどのモノレポ管理ツールは考慮に入れないこととする。

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
  - 工数が他ツールに比べて多少かかる。

**release-it**

[github](https://github.com/release-it/release-it)

- Pros
  - pluginが豊富
  - monorepoにも一応対応している…？
    - https://github.com/release-it/release-it/blob/main/docs/recipes/monorepo.md
  - 2024年時点でNxユーザーからシンプルで効果的なソリューションとして評価
  - semantic-releaseとChangesetsの良いところを併せ持つと評価される
  - セットアップが簡単で、ほとんどのプロジェクトに十分な機能を提供
- Cons
  - monorepo対応が完全ではない（レシピレベルの対応）
  - 複雑なmonorepo環境では制約がある

参考記事
- [release-itとGitHub ActionsによってNode.jsパッケージのリリース作業を自動化する](https://qiita.com/ljourm/items/ee24b318908a8773677b)

**GitVersion**

[公式ドキュメント](https://gitversion.net/)

- Pros
  - 複数のブランチ戦略に対応(https://gitversion.net/docs/reference/configuration)
  - Conventional Commitsに対応可能(https://gitversion.net/docs/reference/version-increments#conventional-commit-messages)
  - v6.3.0でドット記法設定ファイルのサポートなど機能拡張
- Cons
  - モノレポ非対応(https://github.com/GitTools/GitVersion/issues/2441#issuecomment-786649142)
  - 2024年時点でもmonorepo独立バージョニングの課題は未解決
  - 各言語毎のバージョン管理フィールドは手動書き換えが必要(https://gitversion.net/docs/learn/how-it-works)
  - 設定ファイルが膨大
  - リポジトリレベルでの動作のため、全プロジェクト共通バージョンのみ対応

**release-please**

[github](https://github.com/googleapis/release-please)

- Pros
  - 複数言語に対してビルドバージョンも自動アップデート可能
  - Conventional Commits対応。Release Noteも自動生成
  - モノレポ対応
  - 2024年時点でmonorepo環境での採用が増加傾向
  - manifest-driven releaseによる複数プロジェクトの独立リリースサイクル対応
  - GitHub Actionsとの組み合わせが標準的なCI/CD構成として定着
- Cons
  - 複雑なブランチ戦略には対応していない
  - リリースの度にPRが作成されるのをマージしなければならない
  - トランクベース開発フローを対象としているが、現在のプロダクトとの相性が悪い
  - 活動が活発ではない

**Changesets**

[github](https://github.com/changesets/changesets)

- Pros
  - Conventional Commits対応、Release Note自動生成
- Cons
  - JavaScript/TypeScriptエコシステム中心（他言語への対応が限定的）

**@microsoft/rush**

- Pros
  - 大規模monorepoに対する堅牢なツール
  - 厳密なバージョニングと依存関係管理
- Cons
  - スター数がnx,lerna,turborepoに比べて1/4以下
  - 求めているユースケースに対してライブラリが巨大

#### 結論

claude codeに聞いてみました。cs-tools拡張！

<details><summary>長いので折り畳み</summary>
自分: バージョン算出ステップの各ツールのProConを見て、どのツールを使うのが一番いいでしょうか。定量的な評価視点を与えて評価してください

claude code:
要件と各ツールのPros/Consを基に、定量的な評価を行います。

  評価基準（重み付け）

  MUST要件（各20点）:
  1. alphaバージョンやrcバージョンを出し分け可能
  2. モノレポ対応
  3. Container Registry対応（バージョンリリース要件）

  SHOULD要件（各10点）:
  4. Release Note自動生成
  5. 言語に応じてビルドバージョン更新
  6. 複数言語対応

  その他考慮事項（各5点）:
  7. 導入・運用の容易さ
  8. メンテナンス性・継続性
  9. 既存ワークフロー適合性
  10. 実装工数

  総合評価（100点満点）

  各ツール評価

  cs-tools拡張

  - alpha/rc対応: 20点（拡張で対応可能）
  - モノレポ対応: 20点（設定ファイルで対応予定）
  - Container Registry対応: 20点（configファイルで対応可能）
  - Release Note生成: 10点（拡張で対応可能）
  - ビルドバージョン更新: 10点（対応可能）
  - 複数言語対応: 10点（設計次第で対応可能）
  - 導入運用容易さ: 5点（チーム内メンテナ在籍）
  - メンテナンス性: 5点（自社管理）
  - 既存適合性: 5点（現行cs-tools使用中）
  - 実装工数: 3点（工数がかかる）
  合計: 108点

  release-it

  - alpha/rc対応: 15点（プラグインで対応可能だが完全ではない）
  - モノレポ対応: 10点（レシピレベルの対応）
  - Container Registry対応: 15点（プラグインで対応）
  - Release Note生成: 8点（プラグイン依存）
  - ビルドバージョン更新: 5点（限定的）
  - 複数言語対応: 5点（JavaScript中心）
  - 導入運用容易さ: 10点（シンプル）
  - メンテナンス性: 8点（活発なコミュニティ）
  - 既存適合性: 3点（ワークフロー変更必要）
  - 実装工数: 8点（比較的少ない）
  合計: 87点

  release-please

  - alpha/rc対応: 5点（トランクベースのため制限）
  - モノレポ対応: 20点（ネイティブ対応）
  - Container Registry対応: 15点（GitHub Actions組み合わせで対応）
  - Release Note生成: 10点（自動生成）
  - ビルドバージョン更新: 10点（複数言語対応）
  - 複数言語対応: 8点（多言語対応だがJavaScript中心）
  - 導入運用容易さ: 5点（PR マージ workflow必要）
  - メンテナンス性: 3点（メンテ停滞気味）
  - 既存適合性: 2点（トランクベース前提）
  - 実装工数: 8点（比較的少ない）
  合計: 86点

  GitVersion

  - alpha/rc対応: 20点（ブランチ戦略対応）
  - モノレポ対応: 0点（非対応）
  - Container Registry対応: 10点（手動設定必要）
  - Release Note生成: 5点（限定的）
  - ビルドバージョン更新: 5点（手動更新）
  - 複数言語対応: 3点（.NET中心）
  - 導入運用容易さ: 3点（設定が複雑）
  - メンテナンス性: 8点（活発）
  - 既存適合性: 8点（ブランチ戦略適合）
  - 実装工数: 5点（設定工数大）
  合計: 67点

  Changesets

  - alpha/rc対応: 15点（prereleaseサポート）
  - モノレポ対応: 20点（専用設計）
  - Container Registry対応: 10点（GitHub Actions組み合わせ）
  - Release Note生成: 10点（自動生成）
  - ビルドバージョン更新: 5点（JavaScript/TS限定）
  - 複数言語対応: 2点（JS/TS中心）
  - 導入運用容易さ: 8点（直感的）
  - メンテナンス性: 9点（2024年トレンド）
  - 既存適合性: 3点（ワークフロー変更大）
  - 実装工数: 7点（比較的少ない）
  合計: 89点

  推奨結論

  1位: cs-tools拡張 (108点)
  - 全要件に対応可能
  - 既存ワークフローとの親和性が高い
  - 実装工数はかかるが、長期的な柔軟性が高い

  2位: Changesets (89点)
  - モノレポ専用設計で優秀
  - ただし複数言語対応が課題

  3位: release-it (87点)
  - バランスが良いが、モノレポ対応が不完全

  推奨: 要件を完全に満たす必要があり、既存のcs-toolsへの投資もあることから、cs-tools拡張が最適解と評価されます。
</details>

### バージョン適用ステップ

バージョン算出で決定されたバージョンを、各言語のプロジェクトファイルに適用するステップの検討。

**cs-tools拡張**

- Pros
  - TypeScript/Rust両方に対応可能な設計が可能
  - package.json、Cargo.tomlの両方を更新可能
  - 既存ワークフローとの親和性
  - 依存関係の更新も含めて対応可能
- Cons
  - 実装工数がかかる
  - 各言語固有の仕様に対応する必要がある

**File Version Bumper (GitHub Action)**

[GitHub Marketplace](https://github.com/marketplace/actions/file-version-bumper)

- Pros
  - JSON/TOML両対応でpackage.json、Cargo.toml両方をサポート
  - GitHub Actions統合
  - モノレポ対応（複数ファイル処理可能）
  - 導入が簡単
- Cons
  - GitHub Actions環境での実行に限定
  - 複雑な依存関係更新には対応していない可能性
  - カスタマイズ性が限定的

**bumpversion/bump2version**

[PyPI](https://pypi.org/project/bumpversion/)

- Pros
  - 設定ファイルで複数ファイルの同期更新が可能
  - Python/JavaScript/Rust全対応可能
  - Conventional Commits対応
- Cons
  - 元のbumpversionはメンテ停止、フォーク版を使用する必要
  - 設定が複雑になりがち
  - モノレポでの独立バージョニングには不向き

**proto + 各言語専用ツール組み合わせ**

[moonrepo/proto](https://moonrepo.dev/proto)

- Pros
  - TypeScript、Rust、Python全対応の版管理
  - 軽量で高速（Rust製）
  - 各言語の専用ツールと組み合わせ可能
- Cons
  - バージョン管理ツールであり、バージョン適用ツールではない
  - 別途適用ロジックが必要
  - 統合的なソリューションではない

**release-please**

- Pros
  - 複数言語のビルドファイル自動更新
  - package.json、Cargo.toml、pyproject.toml対応
  - モノレポネイティブ対応
- Cons
  - バージョン算出と密結合
  - トランクベース前提
  - 既存ワークフローとの適合性に課題

#### 評価基準（重み付け）

**MUST要件（各20点）:**
1. モノレポ対応
2. TypeScript + Rust両方対応

**SHOULD要件（各15点）:**
3. 設定の容易さ
4. 既存ワークフロー適合性

**その他考慮事項（各10点）:**
5. 導入コスト
6. メンテナンス性
7. 拡張性

#### 各ツール評価

**cs-tools拡張**
- モノレポ対応: 20点（設計で対応）
- TypeScript+Rust対応: 20点（両方対応可能）
- 設定容易さ: 10点（カスタム実装）
- 既存適合性: 15点（cs-tools拡張）
- 導入コスト: 7点（実装工数あり）
- メンテナンス性: 8点（自社管理）
- 拡張性: 10点（自由に拡張可能）
**合計: 90点**

**File Version Bumper**
- モノレポ対応: 15点（複数ファイル対応だが制限あり）
- TypeScript+Rust対応: 20点（JSON/TOML対応）
- 設定容易さ: 15点（GitHub Action）
- 既存適合性: 10点（ワークフロー変更必要）
- 導入コスト: 10点（即座に利用可能）
- メンテナンス性: 7点（第三者依存）
- 拡張性: 5点（カスタマイズ制限）
**合計: 82点**

**release-please**
- モノレポ対応: 20点（ネイティブ対応）
- TypeScript+Rust対応: 18点（両方対応）
- 設定容易さ: 12点（manifest設定）
- 既存適合性: 5点（トランクベース前提）
- 導入コスト: 8点（設定工数あり）
- メンテナンス性: 6点（メンテ停滞）
- 拡張性: 7点（設定範囲内）
**合計: 76点**

**bumpversion系**
- モノレポ対応: 10点（制限的）
- TypeScript+Rust対応: 15点（設定次第）
- 設定容易さ: 8点（設定複雑）
- 既存適合性: 12点（CLI統合可能）
- 導入コスト: 8点（学習コスト）
- メンテナンス性: 6点（フォーク版）
- 拡張性: 8点（設定ファイルベース）
**合計: 67点**

#### 推奨結論

**1位: cs-tools拡張 (90点)**
- 要件を完全に満たし、既存ワークフローとの統合が容易
- 長期的な拡張性と柔軟性を確保

**2位: File Version Bumper (82点)**
- 導入コストが低く、基本要件を満たす
- GitHub Actions環境での制約がある

**3位: release-please (76点)**
- 機能面では優秀だが、既存ワークフローとの適合性に課題

**推奨:** バージョン算出と同様、**cs-tools拡張**がバージョン適用においても最適解。統合的なソリューションとして一貫性を保てる。

### バージョンリリースステップ

算出・適用されたバージョンを各言語の主要レジストリとContainer Registryに公開するステップの検討。

**cs-tools拡張**

- Pros
  - npm、crates.io、Docker Registry全対応可能な設計
  - GitHub Actions統合でCI/CD自動化
  - モノレポでの複数プロジェクト同時リリース対応
  - 既存ワークフローとの親和性
  - カスタムレジストリ対応も可能
- Cons
  - 実装工数がかかる
  - 各レジストリのAPI仕様に対応する必要がある

**Lerna + npm publish**

[Lerna公式](https://lerna.js.org/)

- Pros
  - JavaScript/TypeScriptパッケージのnpmリリースに特化
  - モノレポネイティブ対応
  - `lerna publish`で一括公開
  - 依存関係の順序を考慮したリリース
- Cons
  - JavaScript/TypeScript以外の言語に非対応
  - Container Registry非対応
  - Rustクレートのcrates.io公開に非対応

**GitHub Actions + 各種Publish Action**

- Pros
  - npm、Docker、crates.io向けの豊富なActionが利用可能
  - 言語別のワークフローを組み合わせ可能
  - GitHub Packages統合
  - 設定が比較的簡単
- Cons
  - 統合的な管理が困難
  - 複数言語での一貫したリリースフローの構築が複雑
  - エラーハンドリングが分散

**semantic-release + 各種プラグイン**

[semantic-release](https://semantic-release.gitbook.io/semantic-release)

- Pros
  - 自動バージョニング・リリース
  - npm、GitHub Releases、Docker対応プラグインあり
  - Conventional Commits自動解析
  - Release Note自動生成
- Cons
  - モノレポ対応が不完全
  - Rustクレート公開への対応が限定的
  - 設定が複雑化しがち

**splitsh-lite + 個別semantic-release**

[splitsh-lite](https://github.com/splitsh/lite)

- Pros
  - モノレポを言語別リポジトリに分割
  - 各言語で最適なリリースツールを使用可能
  - コミット履歴保持
  - 言語固有のCI/CDパイプライン構築
- Cons
  - リポジトリ管理が複雑化
  - 統合的なリリース管理が困難
  - インフラ運用コストが増加

**Nx Release**

[Nx Release](https://nx.dev/blog/versioning-and-releasing-packages-in-a-monorepo)

- Pros
  - モノレポ専用設計
  - JavaScript/TypeScript標準対応
  - プラグインエコシステム
  - 複数パッケージの協調リリース
- Cons
  - 主にJavaScript/TypeScript中心
  - Rust対応が限定的
  - Container Registry対応要検討

**Docker Buildx + multi-registry push**

- Pros
  - マルチアーキテクチャ対応
  - 複数レジストリ同時プッシュ
  - GitHub Actions統合
  - コンテナイメージ最適化
- Cons
  - Container Registryのみ対応
  - 言語パッケージレジストリに非対応
  - バージョン管理機能なし

#### 評価基準（重み付け）

**MUST要件（各25点）:**
1. モノレポ対応
2. Container Registry対応
3. 複数言語レジストリ対応（npm + crates.io）

**SHOULD要件（各8点）:**
4. GitHub Actions統合
5. 既存ワークフロー適合性
6. Release Note自動生成

**その他考慮事項（各4点）:**
7. 導入コスト
8. メンテナンス性
9. エラーハンドリング

#### 各ツール評価

**cs-tools拡張**
- モノレポ対応: 25点（設計で対応）
- Container Registry対応: 25点（Docker API統合）
- 複数言語レジストリ対応: 25点（npm + crates.io対応）
- GitHub Actions統合: 8点（統合設計）
- 既存適合性: 8点（cs-tools拡張）
- Release Note生成: 8点（実装可能）
- 導入コスト: 3点（実装工数大）
- メンテナンス性: 4点（自社管理）
- エラーハンドリング: 4点（カスタム実装）
**合計: 110点**

**GitHub Actions組み合わせ**
- モノレポ対応: 15点（ワークフロー分散）
- Container Registry対応: 25点（Docker Action利用）
- 複数言語レジストリ対応: 20点（個別Action使用）
- GitHub Actions統合: 8点（ネイティブ対応）
- 既存適合性: 6点（ワークフロー変更大）
- Release Note生成: 6点（Action依存）
- 導入コスト: 4点（学習コスト）
- メンテナンス性: 3点（分散管理）
- エラーハンドリング: 2点（分散処理）
**合計: 89点**

**semantic-release組み合わせ**
- モノレポ対応: 10点（プラグイン依存）
- Container Registry対応: 20点（プラグイン利用）
- 複数言語レジストリ対応: 15点（npm中心）
- GitHub Actions統合: 8点（統合可能）
- 既存適合性: 4点（ワークフロー変更大）
- Release Note生成: 8点（自動生成）
- 導入コスト: 3点（設定複雑）
- メンテナンス性: 3点（プラグイン依存）
- エラーハンドリング: 3点（設定依存）
**合計: 74点**

**Lerna系**
- モノレポ対応: 25点（専用設計）
- Container Registry対応: 0点（非対応）
- 複数言語レジストリ対応: 10点（npm のみ）
- GitHub Actions統合: 6点（統合可能）
- 既存適合性: 4点（JavaScript限定）
- Release Note生成: 6点（制限的）
- 導入コスト: 4点（JS限定なら簡単）
- メンテナンス性: 4点（活発）
- エラーハンドリング: 3点（JS範囲内）
**合計: 62点**

#### 推奨結論

**1位: cs-tools拡張 (110点)**
- 全要件を完全に満たす唯一のソリューション
- 統合的なリリース管理で運用効率が高い
- 長期的な拡張性と保守性を確保

**2位: GitHub Actions組み合わせ (89点)**
- 既存エコシステム活用で導入コストを抑制
- ただし管理の複雑さとエラーハンドリングに課題

**3位: semantic-release組み合わせ (74点)**
- 自動化機能は優秀だが、モノレポ・多言語対応に制限

**推奨:** 3ステップ全体を通して**cs-tools拡張**が一貫して最適解。バージョン算出→適用→リリースの統合的なワークフローを構築できる。

## 参考記事
- [モノレポについて調べるスクラップ](https://zenn.dev/seya/scraps/d6f0ee60fd0eea)
- [Semantic Versioningの闇](https://knqyf263.hatenablog.com/entry/2020/11/10/224424)
- [LernaとGithub Actionsでmonorepoライブラリのリリースを楽にする](https://link-and-motivation.hatenablog.com/entry/2022/11/16/190305)
- [npm-compare.com](https://npm-compare.com/ja-JP/lerna,nx,turbo)
  - 評価結果はAI生成なので同じ結果は見られないと思うが

## 要件

- CLIが主軸
- `.cdtools/`配下に`config.json`として、以下のjson例のような設定情報を管理する。あと、以下のjson例にはないがワークスペース間の依存関係の管理も必要。
  - 差分があるパスのみリリースしたいケースも存在するが、差分があるワークスペース(package-a)に対する依存を持つワークスペース(package-b)は差分がなくても最新のpackage-aをインストールしてリリースしたいため。
    - ワークスペース間の依存関係もそうだが、ルートのtsconfig.jsonなどはワークスペースのビルド結果に関係するので、依存関係元：ファイル/ディレクトリパスベース、依存関係先：ワークスペース名という制限にするのがよさそう
  - 差分がなくともモノレポのすべてのバージョンを揃えておきたいケースも存在するため、リリースバージョン戦略もjsonで指定できるようにする
  - `versionTags`の`stable`は予約語で、正式リリースを表す。
```json
{
	"baseVersion": "1.0.0",
	"versionTags": [
    {
      "alpha": {
        // timestamp or increment(default: timestamp)
        // timestampの例: 1.0.1-rc.20250629135030
        // incrementの例: 1.0.1-rc.0の次: 1.0.1-rc.1など
        "versionSuffixStrategy": "timestamp"
      }
    },
    {
      "rc": {
        "versionSuffixStrategy": "increment",
        // optional: このバージョンをリリースしているPRをend-prすると作成されるバージョン
        // この例では、1.0.1-rc.0, 1.0.1-rc.1, …をリリースしてきたPRをend-prすると1.0.1がリリースされる
        // このフィールドを指定しなかった場合は、そのままのバージョンリリース(end-prする前のリリースが1.0.1-rc.5であれば1.0.1-rc.6がリリースされる)
        "next": "stable"
      }
    }
  ],
	"projects": [
		{
			"path": "./frontend",
			"type": "typescript",
			// MVPでは2つ以上のレジストリにアップロードするシナリオはないが、将来的にnpmとjsrの両方にリリースすることを考慮し、配列で管理する
			"registries": ["npm"],
		},
		{
			"path": "./backend",
			"type": "rust",
			"registries": ["crates"]
		}
	],
	"releaseNotes": {
		"enabled": true,
		"template": "## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}"
	}
}
```
- [cs-tools](https://www.npmjs.com/package/@procube/cs-tools)と同様のリリースフロー
  - `cd-tools init`で、npm用、crates.io用、container registryのリリース用のgithub workflow定義yamlとデフォルトの`config.json`を生成する(どのレジストリリリース用のymlを生成するかはユーザーが選択する(複数可))
    - リリース用yamlは後述の`rc_feat_hoge.json(例)`の差分によってトリガーされるかが決まる。
  - `cd-tools start-pr`で、現在のブランチの最新をpullした後、releaseモードを設定jsonの中からインタラクティブに受け取ってそれに応じたバージョン+ユーザーが入力したブランチ名の`rc:feat/hoge`のようなブランチを作成し、checkoutする。選択したreleaseモードは`.cdtools`配下に、上記の例でいうと`rc_feat_hoge.json`を作成し、その中に記載しておく。({tag:"rc"}のように)
  - cs-toolsには`add-change`コマンドもあるが、そちらはconventional commits準拠のフローにするため、本ライブラリでは実装しない
  - `cd-tools push-pr`コマンドで、各バージョン管理フィールドを更新する(例えばtsでバージョンが1.0.0の状態で`cd-tools push-pr`が実行され、releaseモードとしてrcが設定されていると、package.jsonとcd-config.jsonのバージョン管理フィールドが1.0.1-rc.0に更新される)。この際、リリースバージョン戦略が「差分があるものとその依存関係のみリリース」の場合は`git diff $(git merge-base main HEAD) --name-only`(そのブランチの初回リリース(初回かどうかは`rc_feat_hoge.json`のようなそのブランチ用のjsonに現在のバージョンが記載されているかどうかで判定する))や`git diff HEAD..@{u} --name-only`(そのブランチの初回リリース以外)で出力された差分のあるファイルを元に判定されたリリース対象のワークスペースを`rc_feat_hoge.json`の`releasedWorkspace`フィールドに`{"package-a":"rc-0"}`のようなフィールドを追加する
    - `releasedWorkspace`フィールドに記載されているワークスペースについてgithub actionsのワークフローでrc版などのリリースやtag作成などを行う
    - PRを作成していなければ、`gh pr create`でbase branchをインタラクティブに選択(新しいブランチを作成する選択肢も用意)して作成する。
  - `cd-tools end-pr`で、`config.json`の現在リリースしているバージョンの`versionTag`の`next`の設定に従って最後の`rc_feat_hoge.json(例)`などのバージョン更新を行い、その変更をpushしてリリース用のCDを走らせたあと、`rc_feat_hoge.json`を削除したcommitをpushしたのち`gh pr merge`を行う。
