@extends('backend.layouts.app')

@section('page-title', trans('app.general_settings'))
@section('page-heading', trans('app.general_settings'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.settings.list.update', 'securities') }}" method="POST" id="general-settings-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.general_settings')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					<div class="col-md-4">

						<div class="form-group">
							<label>@lang('app.agent_balance_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="agent_balance_x" value="{{ settings('agent_balance_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.distributor_balance_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="distributor_balance_x" value="{{ settings('distributor_balance_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.shop_balance_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="shop_balance_x" value="{{ settings('shop_balance_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.user_balance_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="user_balance_x" value="{{ settings('user_balance_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.user_in_out_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="user_in_out_x" value="{{ settings('user_in_out_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.game_in_out_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="game_in_out_x" value="{{ settings('game_in_out_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.bank_balance_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="bank_balance_x" value="{{ settings('bank_balance_x') }}">
						</div>
						<div class="form-group">
							<label>@lang('app.user_win_x')</label>
							<input type="number" step="0.0000001" class="form-control" name="user_win_x" value="{{ settings('user_win_x') }}">
						</div>

						<hr>

						<div class="form-group">
							<label>@lang('app.agent_balance_bigger_x')</label>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="agent_balance_bigger_x_block" class="form-control">
								<option value="0" {{ settings('agent_balance_bigger_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('agent_balance_bigger_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="agent_balance_bigger_x_sms" class="form-control">
								<option value="0" {{ settings('agent_balance_bigger_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('agent_balance_bigger_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>



					</div>
					<div class="col-md-4">

						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="agent_balance_x_block" class="form-control">
								<option value="0" {{ settings('agent_balance_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('agent_balance_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="distributor_balance_x_block" class="form-control">
								<option value="0" {{ settings('distributor_balance_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('distributor_balance_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="shop_balance_x_block" class="form-control">
								<option value="0" {{ settings('shop_balance_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('shop_balance_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="user_balance_x_block" class="form-control">
								<option value="0" {{ settings('user_balance_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_balance_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="user_in_out_x_block" class="form-control">
								<option value="0" {{ settings('user_in_out_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_in_out_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="game_in_out_x_block" class="form-control">
								<option value="0" {{ settings('game_in_out_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('game_in_out_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="bank_balance_x_block" class="form-control">
								<option value="0" {{ settings('bank_balance_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('bank_balance_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="user_win_x_block" class="form-control">
								<option value="0" {{ settings('user_win_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_win_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>

						<hr>

						<div class="form-group">
							<label>@lang('app.distributor_balance_bigger_x')</label>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="distributor_balance_bigger_x_block" class="form-control">
								<option value="0" {{ settings('distributor_balance_bigger_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('distributor_balance_bigger_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="distributor_balance_bigger_x_sms" class="form-control">
								<option value="0" {{ settings('distributor_balance_bigger_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('distributor_balance_bigger_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>



					</div>

					<div class="col-md-4">

						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="agent_balance_x_sms" class="form-control">
								<option value="0" {{ settings('agent_balance_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('agent_balance_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="distributor_balance_x_sms" class="form-control">
								<option value="0" {{ settings('distributor_balance_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('distributor_balance_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="shop_balance_x_sms" class="form-control">
								<option value="0" {{ settings('shop_balance_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('shop_balance_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="user_balance_x_sms" class="form-control">
								<option value="0" {{ settings('user_balance_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_balance_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="user_in_out_x_sms" class="form-control">
								<option value="0" {{ settings('user_in_out_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_in_out_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="game_in_out_x_sms" class="form-control">
								<option value="0" {{ settings('game_in_out_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('game_in_out_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="bank_balance_x_sms" class="form-control">
								<option value="0" {{ settings('bank_balance_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('bank_balance_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="user_win_x_sms" class="form-control">
								<option value="0" {{ settings('user_win_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('user_win_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>

						<hr>

						<div class="form-group">
							<label>@lang('app.shop_balance_bigger_x')</label>
						</div>
						<div class="form-group">
							<label>@lang('app.block')</label>
							<select name="shop_balance_bigger_x_block" class="form-control">
								<option value="0" {{ settings('shop_balance_bigger_x_block') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('shop_balance_bigger_x_block') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
							</select>
						</div>
						<div class="form-group">
							<label>@lang('app.send_sms')</label>
							<select name="shop_balance_bigger_x_sms" class="form-control">
								<option value="0" {{ settings('shop_balance_bigger_x_sms') == '0' ? 'selected' : '' }}>@lang('app.no')</option>
								<option value="1" {{ settings('shop_balance_bigger_x_sms') == '1' ? 'selected' : '' }}>@lang('app.yes')</option>
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