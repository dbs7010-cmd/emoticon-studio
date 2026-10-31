"""Read the actual AAPT2 protobuf manifest, not just Expo's app.config.

Schema: Android tools/aapt2/Resources.proto (XmlNode/XmlElement/XmlAttribute).
"""
import json
from pathlib import Path
import sys
import zipfile


def varint(data, offset):
    value = shift = 0
    while shift < 70:
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
        shift += 7
    raise ValueError('Invalid protobuf varint')


def fields(data):
    offset, result = 0, {}
    while offset < len(data):
        key, offset = varint(data, offset)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, offset = varint(data, offset)
        elif wire == 2:
            length, offset = varint(data, offset)
            value = data[offset:offset + length]
            offset += length
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            value = data[offset:offset + length]
            offset += length
        else:
            raise ValueError(f'Unsupported protobuf wire {wire}')
        result.setdefault(number, []).append(value)
    return result


def element(node):
    return fields(fields(node)[1][0])


def attributes(elem):
    result = {}
    for raw in elem.get(4, []):
        attr = fields(raw)
        result[attr[2][0].decode()] = attr.get(3, [b''])[0].decode()
    return result


with zipfile.ZipFile(sys.argv[1]) as archive:
    root = element(archive.read('base/manifest/AndroidManifest.xml'))
    attrs = attributes(root)
    permissions = []
    for raw in root.get(5, []):
        node = fields(raw)
        if 1 not in node:
            continue
        child = element(raw)
        if child.get(3, [b''])[0].decode().startswith('uses-permission'):
            permissions.append(attributes(child).get('name', ''))
    config = json.loads(archive.read('base/assets/app.config'))
    result = {
        'package': attrs.get('package'),
        'manifestVersionCode': int(attrs['versionCode']),
        'configVersionCode': config['android']['versionCode'],
        'adIdPermission': 'com.google.android.gms.permission.AD_ID' in permissions,
        'billingPermission': 'com.android.vending.BILLING' in permissions,
    }
    assert result['package'] == 'com.emoticonstudio.app', result
    assert result['manifestVersionCode'] == result['configVersionCode'] == int(sys.argv[2]), result
    assert result['adIdPermission'] and result['billingPermission'], result
    if len(sys.argv) > 3:
        Path(sys.argv[3]).write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
