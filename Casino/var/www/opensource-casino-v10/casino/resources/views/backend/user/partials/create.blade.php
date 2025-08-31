<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.username')</label>
		<input type="text" class="form-control" id="username" name="username" placeholder="(@lang('app.optional'))" value="">
	</div>
</div>


<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.role')</label>
		<select name="role_id" class="form-control" id="role_id">
			@foreach(Auth::user()->available_roles() as $key => $value)
				<option value="{{ $key }}" {{ old('role_id') == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>


@if(auth()->user()->hasRole(['distributor']))
	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.shops')</label>
			@if(auth()->user()->hasRole(['admin', 'agent']))
				<select name="shop_id" class="form-control" id="shops">
					<option value="0">---</option>
					@foreach($shops as $key => $value)
						<option value="{{ $key }}" {{ old('shop_id') == $key ? 'selected' : '' }}>{{ $value }}</option>
					@endforeach
				</select>
			@else
				<select name="shop_id" class="form-control" id="shops">
					@foreach($shops as $key => $value)
						<option value="{{ $key }}" {{ old('shop_id') == $key ? 'selected' : '' }}>{{ $value }}</option>
					@endforeach
				</select>
			@endif
		</div>
	</div>
@endif
@if(auth()->user()->hasRole(['manager', 'cashier']))
	<input type="hidden" name="shop_id" value="{{ auth()->user()->shop_id }}">
@endif

@if(auth()->user()->hasRole(['cashier']))
	<div class="col-md-6">
		<div class="form-group">
			<label>{{ trans('app.balance') }}</label>
			<input type="text" class="form-control" id="balance" name="balance" value="0">
		</div>
	</div>
@endif
<div class="col-md-6">
	<div class="form-group">
		<label>{{ trans('app.password') }}</label>
		<input type="password" class="form-control" id="password" name="password">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>{{ trans('app.confirm_password') }}</label>
		<input type="password" class="form-control" id="password_confirmation" name="password_confirmation">
	</div>
</div>