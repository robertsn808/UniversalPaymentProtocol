# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import tempfile
from pathlib import Path


def get_server_directory():
    """Get platform-appropriate log directory."""
    base_location = 'aws-api-mcp'
    if os.name == 'nt' or os.uname().sysname == 'Darwin':  # Windows and macOS
        return Path(tempfile.gettempdir()) / base_location
    # Linux
    base_dir = (
        os.environ.get('XDG_RUNTIME_DIR') or os.environ.get('TMPDIR') or tempfile.gettempdir()
    )
    return Path(base_dir) / base_location


TRUTHY_VALUES = frozenset(['true', 'yes', '1'])
READ_ONLY_KEY = 'READ_OPERATIONS_ONLY'
TELEMETRY_KEY = 'AWS_API_MCP_TELEMETRY'


def get_env_bool(env_key: str, default: bool) -> bool:
    """Get a boolean value from an environment variable, with a default."""
    return os.getenv(env_key, str(default)).casefold() in TRUTHY_VALUES


FASTMCP_LOG_LEVEL = os.getenv('FASTMCP_LOG_LEVEL', 'WARNING')
DEFAULT_REGION = os.getenv('AWS_REGION')
READ_OPERATIONS_ONLY_MODE = get_env_bool(READ_ONLY_KEY, False)
OPT_IN_TELEMETRY = get_env_bool(TELEMETRY_KEY, True)
WORKING_DIRECTORY = os.getenv('AWS_API_MCP_WORKING_DIR', get_server_directory() / 'workdir')
AWS_API_MCP_PROFILE_NAME = os.getenv('AWS_API_MCP_PROFILE_NAME')
