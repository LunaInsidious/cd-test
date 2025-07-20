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

## 要件

- CLIが主軸
- `.cdtools/`配下に`config.json`として、以下のjson例のような設定情報を管理する。
  - `versionTags`の`stable`は予約語で、正式リリースを表す。
```json
{
  // 差分がなくともモノレポのすべてのバージョンを揃えておきたいケースも存在するため、リリースバージョン戦略もjsonで指定できるようにする。すべてそろえる⇒fixed, それぞれ差分があるワークスペースとその依存関係のみアップデート(依存先がメジャーアップデートか否かに関わらずパッチアップデート)⇒independent
  "versioningStrategy": "fixed",
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
			"path": "packages/frontend",
			"type": "typescript",
      "baseVersion": "1.0.0",
      // "patch" or "minor" or "major"の配列
      "bumpedVersions": [],
      // 差分があるパスのみリリースしたいケースも存在するが、差分があるワークスペース(package-a)に対する依存を持つワークスペース(package-b)は差分がなくても最新のpackage-aをインストールしてリリースしたいため。
      // ワークスペース間の依存関係もそうだが、ルートのtsconfig.jsonなどはワークスペースのビルド結果に関係するので、依存関係元：ファイル/ディレクトリパスベース、依存関係先：ワークスペース名という制限にするのがよさそう
      "deps": ["packages/backend","package.json"],
			// MVPでは2つ以上のレジストリにアップロードするシナリオはないが、将来的にnpmとjsrの両方にリリースすることを考慮し、配列で管理する
			"registries": ["npm"]
		},
		{
			"path": "packages/backend",
			"type": "rust",
      "baseVersion": "1.0.0-rc.1",
      "bumpedVersions": ["patch", "minor"],
			"registries": ["crates"]
		}
	],
  // とりあえず今回のスコープからは外す
	// "releaseNotes": {
	// 	"enabled": true,
	// 	"template": "## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}"
	// }
}
```
- [cs-tools](https://www.npmjs.com/package/@procube/cs-tools)と同様のリリースフロー
  - `cd-tools init`で、npm用、crates.io用、container registryのリリース用のgithub workflow定義yamlとデフォルトの`config.json`を生成する(どのレジストリリリース用のymlを生成するかはユーザーが選択する(複数可))
    - リリース用yamlは後述の`rc-feat-hoge.json(例)`の差分によってトリガーされるかが決まる。
  - `cd-tools start-pr`で、現在のブランチの最新をpullした後、releaseモードを設定jsonの中からインタラクティブに受け取ってそれに応じたバージョン+ユーザーが入力したブランチ名の`rc:feat/hoge`のようなブランチを作成し、checkoutする。選択したreleaseモードは`.cdtools`配下に、上記の例でいうと`rc-feat-hoge.json`を作成し、その中に記載しておく。({tag:"rc"}のように)
  - cs-toolsには`add-change`コマンドはbump versionを選択する際にのみ使用する。Release Note生成もMVPのスコープには入れない
  - `cd-tools push-pr`コマンドで、各バージョン管理フィールドを更新する(例えばtsでバージョンが1.0.0の状態で`cd-tools push-pr`が実行され、releaseモードとしてrcが設定されていると、package.jsonとcd-config.jsonのバージョン管理フィールドが1.0.1-rc.0に更新される)。この際、リリースバージョン戦略が「差分があるものとその依存関係のみリリース」の場合は`git diff $(git merge-base main HEAD) HEAD --name-only`(そのブランチの初回リリース(初回かどうかは`rc-feat-hoge.json`のようなそのブランチ用のjsonに現在のバージョンが記載されているかどうかで判定する))や`git diff HEAD..@{u} --name-only`(そのブランチの初回リリース以外)で出力された差分のあるファイルを元に判定されたリリース対象のワークスペースを`rc-feat-hoge.json`の`releasedWorkspace`フィールドに`{"package-a":"rc-0"}`のようなフィールドを追加する
    - `releasedWorkspace`フィールドに記載されているワークスペースについてgithub actionsのワークフローでrc版などのリリースやtag作成などを行う
    - PRを作成していなければ、`gh pr create`でbase branchをインタラクティブに選択(新しいブランチを作成する選択肢も用意)して作成する。
  - `cd-tools end-pr`で、`config.json`の現在リリースしているバージョンの`versionTag`の`next`の設定に従って最後の`rc-feat-hoge.json(例)`などのバージョン更新を行い、その変更をpushしてリリース用のCDを走らせたあと、`rc-feat-hoge.json`を削除したcommitをpushしたのち`gh pr merge`を行う。
