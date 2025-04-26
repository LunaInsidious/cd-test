# CDツール紹介

## 課題

以下を満たすツールが欲しい

- [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/)から、[semantic-versioning](https://semver.org/lang/ja/)に則ったリリースフローを自動化できる
- モノレポに対応している(少なくともnpm workspaces)
- Git flowに対応している
- 少なくともNode.jsに対応している(言語非依存の方が望ましい)

## 検討事項

### バージョンアップデート方法

#### CI

- Pros
  - ローカル環境を汚さない
  - ヒューマンミスが発生しにくい
- Cons
  - protected branchにpushする場合、Deploy KeyやGithub Appの設定で手間がかかる
  - protected branchにpushする場合、上記のトークン管理も必要
  - リリース失敗時のリカバリが面倒そう

#### CLI

- Pros
  - protected branchへのpushはユーザー権限を用いて何も設定せずとも可能
- Cons
  - ローカル環境にCLIのインストールが必要
  - ヒューマンミスが発生し得る

## 競合調査

### GitVersion

[公式ドキュメント](https://gitversion.net/)

Pros
- 複数のブランチ戦略に対応
  - https://gitversion.net/docs/reference/configuration
- 言語非依存

Cons
- モノレポ非対応
  - https://github.com/GitTools/GitVersion/issues/2441#issuecomment-786649142



### release-please

[github](https://github.com/googleapis/release-please)
