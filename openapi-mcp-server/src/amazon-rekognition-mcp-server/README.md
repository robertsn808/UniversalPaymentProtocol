# Amazon Rekognition MCP Server

A Model Context Protocol (MCP) server for Amazon Rekognition that enables AI assistants to analyze images using Amazon Rekognition's powerful computer vision capabilities.

## Features

- **Face Collection Management**: Create and manage collections of faces
- **Face Recognition**: Index and search for faces in images
- **Object and Scene Detection**: Identify objects, scenes, and activities in images
- **Content Moderation**: Detect unsafe or inappropriate content
- **Celebrity Recognition**: Identify celebrities in images
- **Face Comparison**: Compare faces between images for similarity
- **Text Detection**: Extract text from images

## Prerequisites

1. Install `uv` from [Astral](https://docs.astral.sh/uv/getting-started/installation/) or the [GitHub README](https://github.com/astral-sh/uv#installation)
2. Install Python using `uv python install 3.10`
3. Set up AWS credentials with access to Amazon Rekognition
   - You need an AWS account with Amazon Rekognition enabled
   - Configure AWS credentials with `aws configure` or environment variables
   - Ensure your IAM role/user has permissions to use Amazon Rekognition

## Installation

| Cursor | VS Code |
|:------:|:-------:|
| [![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/install-mcp?name=awslabs.amazon-rekognition-mcp-server&config=eyJjb21tYW5kIjoidXZ4IGF3c2xhYnMuYW1hem9uLXJla29nbml0aW9uLW1jcC1zZXJ2ZXJAbGF0ZXN0IiwiZW52Ijp7IkFXU19QUk9GSUxFIjoieW91ci1hd3MtcHJvZmlsZSIsIkFXU19SRUdJT04iOiJ1cy1lYXN0LTEiLCJGQVNUTUNQX0xPR19MRVZFTCI6IkVSUk9SIn0sImRpc2FibGVkIjpmYWxzZSwiYXV0b0FwcHJvdmUiOltdfQ%3D%3D) | [![Install on VS Code](https://img.shields.io/badge/Install_on-VS_Code-FF9900?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=Amazon%20Rekognition%20MCP%20Server&config=%7B%22command%22%3A%22uvx%22%2C%22args%22%3A%5B%22awslabs.amazon-rekognition-mcp-server%40latest%22%5D%2C%22env%22%3A%7B%22AWS_PROFILE%22%3A%22your-aws-profile%22%2C%22AWS_REGION%22%3A%22us-east-1%22%2C%22FASTMCP_LOG_LEVEL%22%3A%22ERROR%22%7D%2C%22disabled%22%3Afalse%2C%22autoApprove%22%3A%5B%5D%7D) |

Configure the MCP server in your MCP client configuration (e.g., for Amazon Q Developer CLI, edit `~/.aws/amazonq/mcp.json`):

```json
{
  "mcpServers": {
    "awslabs.amazon-rekognition-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.amazon-rekognition-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "your-aws-profile",
        "AWS_REGION": "us-east-1",
        "BASE_DIR": "/path/to/base/directory",
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

or docker after a successful `docker build -t awslabs/amazon-rekognition-mcp-server .`:

```file
# fictitious `.env` file with AWS temporary credentials
AWS_ACCESS_KEY_ID=<from the profile you set up>
AWS_SECRET_ACCESS_KEY=<from the profile you set up>
AWS_SESSION_TOKEN=<from the profile you set up>
AWS_REGION=<your-region>
BASE_DIR=/path/to/base/directory
```

```json
{
  "mcpServers": {
    "awslabs.amazon-rekognition-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "--interactive",
        "--env-file",
        "/full/path/to/file/above/.env",
        "awslabs/amazon-rekognition-mcp-server:latest"
      ],
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```
NOTE: Your credentials will need to be kept refreshed from your host

## Environment Variables

- `AWS_PROFILE`: AWS CLI profile to use for credentials
- `AWS_REGION`: AWS region to use (default: us-east-1)
- `BASE_DIR`: Base directory for file operations (optional)
- `FASTMCP_LOG_LEVEL`: Logging level (ERROR, WARNING, INFO, DEBUG)

## AWS Authentication

The server uses the AWS profile specified in the `AWS_PROFILE` environment variable. If not provided, it defaults to the default credential provider chain.

```json
"env": {
  "AWS_PROFILE": "your-aws-profile",
  "AWS_REGION": "us-east-1"
}
```

Make sure the AWS profile has permissions to access Amazon Rekognition services. The MCP server creates a boto3 session using the specified profile to authenticate with AWS services.

## Tools

### list_collections

Returns a list of collection IDs in your account.

```python
list_collections() -> dict
```

Returns a dictionary containing a list of collection IDs and face model versions.

### index_faces

Detects faces in an image and adds them to the specified collection.

```python
index_faces(collection_id: str, image_path: str) -> dict
```

Parameters:
- `collection_id`: ID of the collection to add the face to
- `image_path`: Path to the image file

Returns a dictionary containing information about the indexed faces.

### search_faces_by_image

Searches for faces in a collection that match a supplied face.

```python
search_faces_by_image(collection_id: str, image_path: str) -> dict
```

Parameters:
- `collection_id`: ID of the collection to search
- `image_path`: Path to the image file

Returns a dictionary containing information about the matching faces.

### detect_labels

Detects instances of real-world entities within an image.

```python
detect_labels(image_path: str) -> dict
```

Parameters:
- `image_path`: Path to the image file

Returns a dictionary containing detected labels and other metadata.

### detect_moderation_labels

Detects unsafe content in an image.

```python
detect_moderation_labels(image_path: str) -> dict
```

Parameters:
- `image_path`: Path to the image file

Returns a dictionary containing detected moderation labels and other metadata.

### recognize_celebrities

Recognizes celebrities in an image.

```python
recognize_celebrities(image_path: str) -> dict
```

Parameters:
- `image_path`: Path to the image file

Returns a dictionary containing recognized celebrities and other metadata.

### compare_faces

Compares a face in the source input image with faces in the target input image.

```python
compare_faces(source_image_path: str, target_image_path: str) -> dict
```

Parameters:
- `source_image_path`: Path to the source image file
- `target_image_path`: Path to the target image file

Returns a dictionary containing information about the face matches.

### detect_text

Detects text in an image.

```python
detect_text(image_path: str) -> dict
```

Parameters:
- `image_path`: Path to the image file

Returns a dictionary containing detected text elements and their metadata.

## Example Usage

```python
# List available face collections
collections = await list_collections()

# Index a face in a collection
indexed_face = await index_faces(
    collection_id="my-collection",
    image_path="/path/to/face.jpg"
)

# Search for a face in a collection
matches = await search_faces_by_image(
    collection_id="my-collection",
    image_path="/path/to/face.jpg"
)

# Detect labels in an image
labels = await detect_labels(
    image_path="/path/to/image.jpg"
)

# Detect moderation labels in an image
moderation = await detect_moderation_labels(
    image_path="/path/to/image.jpg"
)

# Recognize celebrities in an image
celebrities = await recognize_celebrities(
    image_path="/path/to/celebrity.jpg"
)

# Compare faces between two images
comparison = await compare_faces(
    source_image_path="/path/to/source.jpg",
    target_image_path="/path/to/target.jpg"
)

# Detect text in an image
text = await detect_text(
    image_path="/path/to/image_with_text.jpg"
)
```

## Security Considerations

- Use AWS IAM roles with appropriate permissions
- Store credentials securely
- Use temporary credentials when possible
- Be aware of Amazon Rekognition service quotas and limits

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](https://github.com/awslabs/mcp/blob/main/src/amazon-rekognition-mcp-server/LICENSE) file for details.
