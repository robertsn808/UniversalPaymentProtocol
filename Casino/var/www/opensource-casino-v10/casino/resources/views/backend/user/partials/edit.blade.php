<div class="box-body box-profile">

	<div class="form-group">
		<label>@lang('app.role')</label>
		<select name="role_id" id="role_id" class="form-control" disabled>
			@foreach (Auth::user()->available_roles(true) as $key => $value)
				<option value="{{ $key }}" {{ $edit && $user->role_id == $key ? 'selected' : '' }}>
					{{ $value }}
				</option>
			@endforeach
		</select>
	</div>

	<div class="form-group">
		<label>@lang('app.shops')</label>
		<select name="shops[]" id="shops" class="form-control" {{ $edit ? 'disabled' : '' }} {{ $edit && $user->hasRole(['agent', 'distributor']) ? 'multiple' : '' }}>
			@foreach ($shops as $key => $value)
				<option value="{{ $key }}" {{ ($edit && $user->hasRole(['admin', 'agent', 'distributor']) && in_array($key, $user->shops(true))) || (!$edit && Auth::user()->shop_id == $key) ? 'selected' : '' }}>
					{{ $value }}
				</option>
			@endforeach
		</select>
	</div>

	<div class="form-group">
		<label>@lang('app.status')</label>
		<select name="status" id="status" class="form-control" {{ ($user->hasRole(['admin']) || $user->id == auth()->user()->id) ? 'disabled' : '' }}>
			@foreach ($statuses as $key => $value)
				<option value="{{ $key }}" {{ $edit && $user->status == $key ? 'selected' : '' }}>
					{{ $value }}
				</option>
			@endforeach
		</select>
	</div>

	@if(auth()->user()->hasRole('admin') && $user->hasRole(['agent', 'distributor']))
		<div class="form-group">
			<label for="device">@lang('app.block')</label>
			<select name="is_blocked" class="form-control">
				<option value="0" {{ ($edit && $user->is_blocked == '0') ? 'selected' : (old('is_blocked') == '0' ? 'selected' : '') }}>
					{{ __('app.unblock') }}
				</option>
				<option value="1" {{ ($edit && $user->is_blocked == '1') ? 'selected' : (old('is_blocked') == '1' ? 'selected' : '') }}>
					{{ __('app.block') }}
				</option>
			</select>
		</div>
	@endif

	<div class="form-group">
		<label>@lang('app.username')</label>
		<input type="text" class="form-control" id="username" name="username" placeholder="(@lang('app.optional'))" value="{{ $edit ? $user->username : '' }}">
	</div>

	@if($user->email != '')
		<div class="form-group">
			<label>@lang('app.email')</label>
			<input type="email" class="form-control" id="email" name="email" placeholder="(@lang('app.optional'))" value="{{ $edit ? $user->email : '' }}">
		</div>
	@endif

	<div class="form-group">
		<label>@lang('app.phone')@if($user->phone) @if($user->phone_verified) [Verified] @endif @endif</label>
		<div class="input-group">
			<span class="input-group-addon">+</span>
			<input type="text" class="form-control onlynumber" id="phone" name="phone" value="{{ $edit ? $user->phone : '' }}" @if(!auth()->user()->hasRole('admin') && ($user->phone_token || $user->phone)) disabled @endif>
		</div>
	</div>

	@if($user->sms_token && !$user->phone_verified)
		@php
			$now = \Carbon\Carbon::now();
			$timer_text = 'Time is up';
			$show_code = false;
			$times = $now->diffInSeconds(\Carbon\Carbon::parse($user->sms_token_date), false);
			if ($times > 0) {
				$minutes = floor($times / 60);
				$seconds = $times - floor($times / 60) * 60;
				$show_code = true;
				$timer_text = ($minutes < 10 ? "0" . $minutes : $minutes) . ':' . ($seconds < 10 ? "0" . $seconds : $seconds);
			}
		@endphp
		@if($show_code)
			<div class="form-group" id="timer_code">
				<label>Phone Verification Code

					[<span id="sms_timer" data-seconds="{{ $times }}">{{ $timer_text }}</span>]
				</label>
				<input type="text" class="form-control" id="sms_token" name="sms_token" value="">
			</div>
		@endif
	@endif

	<div class="form-group">
		<label>@lang('app.lang')</label>
		<select name="language" class="form-control">
			@foreach ($langs as $key => $value)
				<option value="{{ $key }}" {{ $edit && $user->language == $key ? 'selected' : '' }}>
					{{ $value }}
				</option>
			@endforeach
		</select>
	</div>

	<div class="form-group">
		<label>{{ $edit ? trans("app.new_password") : trans('app.password') }}</label>
		<input type="password" class="form-control" id="password" name="password" @if ($edit) placeholder="@lang('app.leave_blank_if_you_dont_want_to_change')" @endif>
	</div>

	<div class="form-group">
		<label>{{ $edit ? trans("app.confirm_new_password") : trans('app.confirm_password') }}</label>
		<input type="password" class="form-control" id="password_confirmation" name="password_confirmation" @if ($edit) placeholder="@lang('app.leave_blank_if_you_dont_want_to_change')" @endif>
	</div>

	@if(auth()->user()->hasRole('admin') && !$user->hasRole('admin') && $user->auth_token != '')
		<div class="form-group">
			<label>Auth</label>
			<input value="{{ route('frontend.user.specauth', ['user' => $user->id, 'token' => $user->auth_token]) }}" class="form-control">
		</div>
	@endif

</div>



<div class="box-footer">
	<button type="submit" class="btn btn-primary" id="update-details-btn">
		@lang('app.edit_user')
	</button>
</div>