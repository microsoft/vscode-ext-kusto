# Kusto in Notebooks & Interactive Window

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/items?itemName=donjayamanne.kusto) that provides the ability to run Kusto queries in Notebooks as well as plain text files.

## Features

- Run Kusto Queries
- Graphs & Data Viewer
- Code Completion
- Syntax highlighting
- Code refactoring
- Code formatting
- Kusto panel with access to Clusters, Databases, Tables, etc
- Run Kusto queries in Plain text files, Notebooks or in an Interactive Window

## Authentication Methods

The extension attempts authentication methods in the following order, proceeding to the next if one fails:

1. **Azure CLI Authentication**
   - Uses existing Azure CLI credentials
   - Requires `az login` to be completed

2. **VS Code Azure Authentication**
   - Uses VS Code's built-in Azure authentication
   - No additional tools required

3. **Device Code Authentication**
   - Interactive device code flow
   - Enter code at microsoft.com/devicelogin

4. **Access Token Authentication**
   - Manual access token input
   - Useful for CI/CD scenarios

The authentication process will try each method in sequence until successful authentication is achieved.

Note: For local development, Azure CLI or VS Code authentication is recommended.

## Getting Started

- Open a `*.kql|*.csl` file and start typing to get code completion
- Open a `*.kql|*.csl` file and click on the `Run Query` code lense
- Open a `*.kql|*.csl` file as a notebook
- Create a file with extension `*.knb` (or use the command `Create Kusto Notebook`)
- With text file (`*.kql`, `*.csl`) use the command `Configure Kusto Connection` to configure the Kusto connection
- With notebooks, select the cluster and database from via the Kernel Picker (or `Notebook: Select Notebook Kernel` command)

## Features Demo

### Chat
![Chat Demo](https://raw.githubusercontent.com/donjayamanne/vscode-kusto/main/images/copilot.gif)

### Configure Connection
![Configure Connection](https://raw.githubusercontent.com/donjayamanne/vscode-kusto/main/images/configureConnection.gif)

### Interactive Window
![Interactive Window](https://raw.githubusercontent.com/donjayamanne/vscode-kusto/main/images/interactiveWindow.gif)

### Notebooks
![Notebooks](https://raw.githubusercontent.com/donjayamanne/vscode-kusto/main/images/notebook.gif)

### Schema View
![Schema View](https://raw.githubusercontent.com/donjayamanne/vscode-kusto/main/images/clusters.gif)

## Jupyter Integration

This extension works with Jupyter Notebooks when using [kqlmagic](https://pypi.org/project/Kqlmagic/):

- Augments Jupyter Notebooks with Kusto language features when using the [Jupyter](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter) extension
- Automatically detects cluster and database from cells containing connection information `kql AzureDataExplorer://code;cluster='help';database='Samples'`

### Differences from Jupyter Notebooks

Kusto Notebooks:
- No additional dependencies
- Authentication handled by VS Code

Jupyter Notebooks with [kqlmagic](https://pypi.org/project/Kqlmagic/):
- Requires Python and kqlmagic package installation
- Enables Python-based data analysis

## Roadmap

- Support for more charts
- & more...

## Thanks to the contributors

[Joyce Er](https://github.com/joyceerhl),
[SteVen Batten](https://github.com/sbatten),
[Peng Lyu](https://github.com/rebornix),
[Tanha Kabir](https://github.com/tanhakabir)

## License

MIT
