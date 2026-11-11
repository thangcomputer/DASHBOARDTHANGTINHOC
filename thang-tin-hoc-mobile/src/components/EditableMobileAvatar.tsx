import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, UserRound } from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { uploadAndUpdateAvatar } from '../services/avatarApi';
import { getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { colors } from '../theme/tokens';
import { isFreePortalMenu } from './FreePortalModals';

export type EditableMobileAvatarProps = {
  size?: number;
  avatar?: string;
  name?: string;
  showBadge?: boolean;
  style?: StyleProp<ViewStyle>;
  onSuccess?: (url: string) => void;
};

export function EditableMobileAvatar({
  size = 46,
  avatar,
  name,
  showBadge = true,
  style,
  onSuccess,
}: EditableMobileAvatarProps) {
  const { user, updateAvatar } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const [uploading, setUploading] = useState(false);

  const effectiveAvatar = avatar ?? user?.avatar;
  const imageSource = effectiveAvatar
    ? getMobileImageSource(resolveMobilePublicUrl(effectiveAvatar))
    : null;

  const chooseAvatar = async () => {
    if (uploading) return;
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Cần quyền truy cập ảnh', 'Cho phép ứng dụng truy cập thư viện ảnh để đổi ảnh đại diện.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.92,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      if (result.canceled || !result.assets?.length) return;
      const image = result.assets[0];

      if (image.mimeType && !image.mimeType.toLowerCase().startsWith('image/')) {
        Alert.alert('Ảnh chưa hợp lệ', 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
        return;
      }

      if (image.fileSize != null && image.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Ảnh quá lớn', 'Kích thước ảnh đại diện tối đa là 5MB.');
        return;
      }

      if (user?.previewMode) {
        Alert.alert('Bản xem trước', 'Không thể tải ảnh đại diện lên máy chủ trong bản xem trước.');
        return;
      }

      setUploading(true);
      const extensionByMimeType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };

      const updatedAvatar = await uploadAndUpdateAvatar({
        uri: image.uri,
        name: image.fileName || `avatar-${Date.now()}.${extensionByMimeType[image.mimeType || 'image/jpeg'] || 'jpg'}`,
        mimeType: image.mimeType,
        size: image.fileSize,
        file: image.file,
      });

      await updateAvatar(updatedAvatar);
      onSuccess?.(updatedAvatar);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới.');
    } catch (error) {
      Alert.alert('Không thể đổi ảnh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const badgeSize = Math.max(16, Math.round(size * 0.38));
  const iconSize = Math.max(9, Math.round(badgeSize * 0.58));

  return (
    <Pressable
      onPress={() => { void chooseAvatar(); }}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Đổi ảnh đại diện cho ${name || user?.name || 'tài khoản'}`}
      accessibilityHint="Chạm để chọn ảnh từ thư viện"
    >
      <View style={[styles.avatarBox, { width: size, height: size, borderRadius: size / 2 }]}>
        {imageSource ? (
          <Image source={imageSource} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <UserRound size={Math.round(size * 0.5)} color="#FFFFFF" />
        )}

        {uploading && (
          <View style={[styles.loadingOverlay, { width: size, height: size, borderRadius: size / 2 }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </View>

      {showBadge && !uploading && (
        <View
          style={[
            styles.cameraBadge,
            isBrandStudent && { backgroundColor: '#EF4444' },
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: -1,
              right: -1,
            },
          ]}
        >
          <Camera size={iconSize} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBox: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  image: {
    resizeMode: 'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});
