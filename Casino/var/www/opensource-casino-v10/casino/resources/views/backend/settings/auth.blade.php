@extends('backend.layouts.app')

@section('page-title', trans('app.general_settings'))
@section('page-heading', trans('app.general_settings'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.settings.list.update', 'auth') }}" method="POST" id="general-settings-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.general_settings')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					<div class="col-md-6">
						<div class="form-group">
							<label>
								@lang('app.reset_token_lifetime')
							</label>
							<input type="number" step="0.0000001" name="login_reset_token_lifetime" class="form-control" value="{{ settings('login_reset_token_lifetime', 30) }}">
						</div>
						<div class="form-group">
							<label>
								@lang('app.use_email')
							</label>
							<select name="use_email" class="form-control">
								<option value="0" {{ settings('use_email') == '0' ? 'selected' : '' }}>{{ __('app.no') }}</option>
								<option value="1" {{ settings('use_email') == '1' ? 'selected' : '' }}>{{ __('app.yes') }}</option>
							</select>
						</div>

						<div class="form-group">
							<label>
								@lang('app.reset_authentication')
							</label>
							<select name="reset_authentication" class="form-control">
								<option value="0" {{ settings('reset_authentication') == '0' ? 'selected' : '' }}>{{ __('app.no') }}</option>
								<option value="1" {{ settings('reset_authentication') == '1' ? 'selected' : '' }}>{{ __('app.yes') }}</option>
							</select>
						</div>
						<div class="form-group">
							<label>
								@lang('app.maximum_number_of_attempts')
								<small class="text-muted">@lang('app.max_number_of_incorrect_login_attempts')</small>
							</label>
							<input type="number" step="0.0000001" name="throttle_attempts" class="form-control" value="{{ settings('throttle_attempts', 10) }}">
						</div>
					</div>
					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.lockout_time')</label>
							<input type="number" step="0.0000001" name="throttle_lockout_time" class="form-control" value="{{ settings('throttle_lockout_time', 1) }}">
						</div>
						<div class="form-group">
							<label>@lang('app.throttle_authentication')</label>
							<select name="throttle_enabled" class="form-control">
								<option value="0" {{ settings('throttle_enabled') == '0' ? 'selected' : '' }}>{{ __('app.no') }}</option>
								<option value="1" {{ settings('throttle_enabled') == '1' ? 'selected' : '' }}>{{ __('app.yes') }}</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.allow_registration')</label>
							<select name="reg_enabled" class="form-control">
								<option value="0" {{ settings('reg_enabled') == '0' ? 'selected' : '' }}>{{ __('app.no') }}</option>
								<option value="1" {{ settings('reg_enabled') == '1' ? 'selected' : '' }}>{{ __('app.yes') }}</option>
							</select>
						</div>

						<div class="form-group">
							<label>@lang('app.forgot_password')</label>
							<select name="forgot_password" class="form-control">
								<option value="0" {{ settings('forgot_password') == '0' ? 'selected' : '' }}>{{ __('app.no') }}</option>
								<option value="1" {{ settings('forgot_password') == '1' ? 'selected' : '' }}>{{ __('app.yes') }}</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_settings')
				</button>



			</div>
		</form>
	</div>
</section>

@stop